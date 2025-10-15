from fastapi import APIRouter, HTTPException, status, Depends, Query, Form, UploadFile, File

from app.supabase_client import (
    insert_data, get_data, update_data, delete_data, count_records, upload_file_from_bytes,
    get_paginated_data, search_data, get_user_vote_status, upload_file_from_bytes_with_service_role, get_public_url
)
from app.schemas import (
    IssueCreate, IssueResponse, IssueUpdate, IssueListResponse,
    IssueSearchRequest, VoteResponse, PaginationResponse, BaseResponse, FileUploadResponse
)
from app.routes.auth import get_current_user, require_roles, get_current_user_optional
from app.services.notification_service import NotificationService
from app.utils.helpers import generate_uuid, validate_image_file, compress_image
from typing import List, Optional, Literal
import logging
import math
import os
from datetime import datetime
from io import BytesIO

# Department-Category Mapping (same as frontend)
DEPARTMENT_CATEGORIES = {
    'Road Department': ['potholes'],
    'Electricity Department': ['DamagedElectricalPoles'],
    'Sanitary Department': ['Garbage'],
    'Public Service': ['WaterLogging', 'FallenTrees']
}

def apply_department_filtering(user_role: str, user_department: str, filters: dict) -> dict:
    """Apply department-based filtering to issue queries."""
    if user_role == "admin":
        return filters  # Admin sees all issues
    
    if user_role in ["staff", "supervisor"] and user_department:
        # Get allowed categories for the user's department
        allowed_categories = DEPARTMENT_CATEGORIES.get(user_department, [])
        
        if allowed_categories:
            # If there's already a category filter, intersect it with allowed categories
            if "category" in filters:
                existing_category = filters["category"]
                if isinstance(existing_category, list):
                    # Intersect with allowed categories
                    filters["category"] = [cat for cat in existing_category if cat in allowed_categories]
                elif existing_category in allowed_categories:
                    # Keep the existing category if it's allowed
                    filters["category"] = existing_category
                else:
                    # Category not allowed, return empty results
                    filters["category"] = []
            else:
                # Add department filter
                filters["category"] = allowed_categories
        else:
            # Department not mapped, no access
            filters["category"] = []
    
    return filters

logger = logging.getLogger(__name__)
router = APIRouter()

# Camera/File upload configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
BUCKET_NAME = "project0_storage"


def _process_issue_data(issue_data: dict, user_vote_status: dict = None) -> dict:
    """Process raw issue data to include additional fields."""
    # Handle citizen profile data
    if issue_data.get("profiles"):
        issue_data["citizen_name"] = issue_data["profiles"].get("full_name")
        issue_data["citizen_phone"] = issue_data["profiles"].get("phone")
        del issue_data["profiles"]
    
    # Add vote status if provided
    if user_vote_status and issue_data.get("id"):
        issue_data["user_has_voted"] = user_vote_status.get(issue_data["id"], False)
    
    # Calculate days open
    if issue_data.get("created_at"):
        created_date = datetime.fromisoformat(issue_data["created_at"].replace("Z", "+00:00"))
        days_open = (datetime.now().replace(tzinfo=created_date.tzinfo) - created_date).days
        issue_data["days_open"] = days_open
    
    return issue_data


def _validate_user_authentication(current_user: dict) -> tuple[str, str]:
    """Validate user authentication and return user_id and role."""
    if not current_user or not current_user.get("profile"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return current_user["profile"]["id"], current_user["profile"]["role"]


async def _handle_image_upload(
    file: UploadFile, 
    user_id: str, 
    compress: bool = True,
    max_width: int = 1920,
    max_height: int = 1080,
    quality: int = 85
) -> str:
    """Handle image upload with authentication and validation."""
    # Validate file type
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
    
    # Read and validate file
    file_content = await file.read()
    
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    if not validate_image_file(file_content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted image file"
        )
    
    # Compress image if requested
    if compress:
        try:
            file_content = compress_image(
                file_content, 
                max_width=max_width, 
                max_height=max_height,
                quality=quality
            )
            logger.info(f"Image compressed for user {user_id}: size {len(file_content)} bytes")
        except Exception as e:
            logger.warning(f"Image compression failed for user {user_id}, using original: {str(e)}")
    
    # Generate unique filename with correct issues folder path
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    unique_filename = f"issues/{user_id}/{generate_uuid()}{file_extension}"
    
    # Upload to storage with authentication context
    try:
        file_url = file_url = upload_file_from_bytes(
            bucket=BUCKET_NAME,
            file_name=unique_filename,
            file_bytes=file_content,
            content_type=file.content_type
        )
        
        logger.info(f"Image uploaded successfully: {unique_filename} by authenticated user {user_id}")
        return file_url
        
    except Exception as e:
        logger.error(f"Failed to upload image for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image to storage"
        )


@router.post("/upload-image", response_model=FileUploadResponse)
async def upload_issue_image_with_auth(
    file: UploadFile = File(...),
    compress: bool = Form(True),
    max_width: int = Form(1920),
    max_height: int = Form(1080),
    quality: int = Form(85),
    current_user: dict = Depends(get_current_user)
):
    """Upload image with proper authentication for camera access."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Handle image upload
        file_url = await _handle_image_upload(
            file, user_id, compress, max_width, max_height, quality
        )
        
        # Get file size after processing
        file_content = await file.read()
        await file.seek(0)  # Reset file pointer
        
        logger.info(f"Camera image uploaded successfully by user {user_id} ({user_role})")
        
        return FileUploadResponse(
            success=True,
            message="Image uploaded successfully from camera",
            file_url=file_url,
            file_name=file.filename or "camera_image.jpg",
            file_size=len(file_content),
            content_type=file.content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Camera image upload failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image from camera"
        )


@router.post("/", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(
    issue: IssueCreate, 
    current_user: dict = Depends(get_current_user)
):
    """Create a new issue with authenticated user context."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Set citizen_id for citizens, allow admin/supervisor to specify
        if user_role == "citizen":
            issue.citizen_id = user_id
        elif not issue.citizen_id:
            issue.citizen_id = user_id
        
        # Create issue
        issue_data = issue.dict()
        result = insert_data("issues", issue_data)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create issue"
            )
        
        # Get the created issue with citizen info
        created_issue = get_data(
            "issues",
            {"id": result[0]["id"]},
            select_fields="*, profiles!citizen_id(full_name, phone)"
        )
        
        if not created_issue:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created issue"
            )
        
        # Process issue data
        issue_response_data = _process_issue_data(created_issue[0])
        
        # Send notification
        try:
            citizen_data = get_data("profiles", {"id": issue.citizen_id})
            if citizen_data:
                NotificationService.notify_issue_created(
                    issue_response_data, 
                    citizen_data[0]
                )
        except Exception as e:
            logger.warning(f"Failed to send notification: {str(e)}")
        
        logger.info(f"Issue created: {result[0]['id']} by authenticated user {user_id}")
        return IssueResponse(**issue_response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create issue: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create issue"
        )


@router.post("/create-with-image", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue_with_image(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_description: Optional[str] = Form(None),
    priority: str = Form("medium"),
    file: Optional[UploadFile] = File(None),
    compress_image: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """Create issue with optional image upload (camera support)."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Handle image upload if provided
        image_url = None
        if file:
            try:
                image_url = await _handle_image_upload(file, user_id, compress_image)
                logger.info(f"Image attached to issue by user {user_id}")
            except Exception as e:
                logger.error(f"Image upload failed during issue creation: {str(e)}")
                # Continue with issue creation even if image upload fails
                
        # Create issue data
        issue_data = {
            "title": title,
            "description": description,
            "category": category,
            "latitude": latitude,
            "longitude": longitude,
            "location_description": location_description,
            "priority": priority,
            "citizen_id": user_id if user_role == "citizen" else user_id,
            "status": "pending",
            "upvotes": 0
        }
        
        # Add image URL if uploaded
        if image_url:
            # Store image URLs as JSON array for multiple images support
            issue_data["image_urls"] = image_url
        
        # Insert issue
        result = insert_data("issues", issue_data)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create issue"
            )
        
        # Get created issue with full data
        created_issue = get_data(
            "issues",
            {"id": result[0]["id"]},
            select_fields="*, profiles!citizen_id(full_name, phone)"
        )
        
        if not created_issue:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created issue"
            )
        
        # Process and return issue data
        issue_response_data = _process_issue_data(created_issue[0])
        
        # Send notification
        try:
            citizen_data = get_data("profiles", {"id": user_id})
            if citizen_data:
                NotificationService.notify_issue_created(
                    issue_response_data, 
                    citizen_data[0]
                )
        except Exception as e:
            logger.warning(f"Failed to send notification: {str(e)}")
        
        logger.info(f"Issue with image created: {result[0]['id']} by authenticated user {user_id}")
        return IssueResponse(**issue_response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create issue with image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create issue with image"
        )


@router.get("/", response_model=IssueListResponse)
async def list_issues(
    status_filter: Optional[Literal["pending", "in_progress", "resolved"]] = Query(None, alias="status"),
    category: Optional[Literal["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]] = Query(None),
    citizen_id: Optional[str] = Query(None, description="Filter by citizen ID"),
    department: Optional[str] = Query(None, description="Filter by assigned department"),
    min_upvotes: Optional[int] = Query(None, description="Minimum upvotes"),
    has_location: Optional[bool] = Query(None, description="Filter issues with/without location"),
    search: Optional[str] = Query(None, description="Search in title and description"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    order_by: str = Query("-created_at", description="Order by field"),
    current_user: dict = Depends(get_current_user)
):
    """List issues with comprehensive filtering and pagination."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        user_department = current_user["profile"].get("department")
        
        filters = {}
        
        # Role-based filtering
        if user_role == "citizen":
            filters["citizen_id"] = user_id
        elif citizen_id and user_role in ["admin", "supervisor"]:
            filters["citizen_id"] = citizen_id
        
        # Apply other filters BEFORE department filtering
        if status_filter:
            filters["status"] = status_filter
        if category:
            filters["category"] = category
        if min_upvotes is not None:
            filters["upvotes"] = {"operator": "gte", "value": min_upvotes}
        if has_location is not None:
            if has_location:
                filters["latitude"] = {"operator": "neq", "value": None}
            else:
                filters["latitude"] = None
        
        # APPLY DEPARTMENT FILTERING (NEW)
        filters = apply_department_filtering(user_role, user_department, filters)
        
        # Handle empty category filter (no access)
        if "category" in filters and not filters["category"]:
            # Return empty result if user has no access to any categories
            return IssueListResponse(
                success=True,
                issues=[],
                pagination=PaginationResponse(
                    total=0, page=page, per_page=per_page, 
                    total_pages=1, has_next=False, has_prev=False
                )
            )
        
        # Search functionality
        if search:
            issues = search_data(
                table="issues",
                search_fields=["title", "description"],
                search_term=search,
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by=order_by
            )
            total = len(issues)
            # Manual pagination for search results
            start = (page - 1) * per_page
            end = start + per_page
            paginated_issues = issues[start:end]
        else:
            paginated_issues, total = get_paginated_data(
                table="issues",
                page=page,
                per_page=per_page,
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by=order_by
            )
        
        # Get user vote status for all issues
        issue_ids = [issue["id"] for issue in paginated_issues]
        user_vote_status = {}
        if issue_ids:
            user_vote_status = get_user_vote_status(user_id, issue_ids)
        
        # Process issues data
        processed_issues = []
        for issue in paginated_issues:
            issue_data = _process_issue_data(issue, user_vote_status)
            processed_issues.append(IssueResponse(**issue_data))
        
        # Calculate pagination metadata
        total_pages = math.ceil(total / per_page) if total > 0 else 1
        
        pagination = PaginationResponse(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
        logger.info(f"Listed {len(processed_issues)} issues for authenticated {user_role}")
        return IssueListResponse(
            success=True,
            issues=processed_issues,
            pagination=pagination
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list issues: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch issues"
        )


@router.post("/search", response_model=IssueListResponse)
async def search_issues(
    search_request: IssueSearchRequest,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Advanced search for issues."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        filters = {}
        
        # Role-based access control
        if user_role == "citizen":
            filters["citizen_id"] = user_id
        
        # Apply search filters
        if search_request.category:
            filters["category"] = search_request.category
        if search_request.status:
            filters["status"] = search_request.status
        if search_request.citizen_id and user_role in ["admin", "supervisor"]:
            filters["citizen_id"] = search_request.citizen_id
        if search_request.min_upvotes is not None:
            filters["upvotes"] = {"operator": "gte", "value": search_request.min_upvotes}
        if search_request.date_from:
            filters["created_at"] = {"operator": "gte", "value": search_request.date_from.isoformat()}
        if search_request.date_to:
            filters["created_at"] = {"operator": "lte", "value": search_request.date_to.isoformat()}
        if search_request.has_location is not None:
            if search_request.has_location:
                filters["latitude"] = {"operator": "neq", "value": None}
            else:
                filters["latitude"] = None
        
        # Perform search
        if search_request.query:
            issues = search_data(
                table="issues",
                search_fields=["title", "description"],
                search_term=search_request.query,
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by="-created_at"
            )
            total = len(issues)
            start = (page - 1) * per_page
            end = start + per_page
            paginated_issues = issues[start:end]
        else:
            paginated_issues, total = get_paginated_data(
                table="issues",
                page=page,
                per_page=per_page,
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by="-created_at"
            )
        
        # Get user vote status
        issue_ids = [issue["id"] for issue in paginated_issues]
        user_vote_status = get_user_vote_status(user_id, issue_ids) if issue_ids else {}
        
        # Process results
        processed_issues = []
        for issue in paginated_issues:
            issue_data = _process_issue_data(issue, user_vote_status)
            processed_issues.append(IssueResponse(**issue_data))
        
        # Pagination
        total_pages = math.ceil(total / per_page) if total > 0 else 1
        pagination = PaginationResponse(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
        return IssueListResponse(
            success=True,
            issues=processed_issues,
            pagination=pagination
        )
        
    except Exception as e:
        logger.error(f"Failed to search issues: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search issues"
        )


@router.get("/stats")
async def get_issue_stats(
    current_user: dict = Depends(require_roles(["admin", "supervisor", "staff"]))
):
    """Get issue statistics."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Base statistics
        stats = {
            "total_issues": 0,
            "pending_issues": 0,
            "in_progress_issues": 0,
            "resolved_issues": 0,
            "issues_by_category": {},
            "issues_by_department": {},
            "total_upvotes": 0,
            "avg_resolution_time": None
        }
        
        # Role-based filtering
        if user_role == "supervisor":
            # Get issues in supervisor's department
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
            staff_ids = [s["id"] for s in dept_staff]
            
            if staff_ids:
                assignments = get_data("issue_assignments", {"staff_id": staff_ids})
                issue_ids = [a["issue_id"] for a in assignments]
                if issue_ids:
                    issues_filter = {"id": issue_ids}
                else:
                    issues_filter = {"id": []}  # No issues
            else:
                issues_filter = {"id": []}
        else:
            issues_filter = {}
        
        # Get counts
        if user_role != "supervisor" or (user_role == "supervisor" and issues_filter.get("id")):
            stats["total_issues"] = count_records("issues", issues_filter)
            stats["pending_issues"] = count_records("issues", {**issues_filter, "status": "pending"})
            stats["in_progress_issues"] = count_records("issues", {**issues_filter, "status": "in_progress"})
            stats["resolved_issues"] = count_records("issues", {**issues_filter, "status": "resolved"})
            
            # Get issues by category
            categories = ["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]
            for category in categories:
                count = count_records("issues", {**issues_filter, "category": category})
                stats["issues_by_category"][category] = count
            
            # Get total upvotes
            all_issues = get_data("issues", filters=issues_filter, select_fields="upvotes")
            stats["total_upvotes"] = sum(issue.get("upvotes", 0) for issue in all_issues)
        
        # Get issues by department (admin only)
        if user_role == "admin":
            departments = get_data("profiles", 
                                 select_fields="DISTINCT department", 
                                 filters={"role": "staff", "department": {"operator": "neq", "value": None}})
            
            for dept_data in departments:
                dept = dept_data["department"]
                if dept:
                    dept_staff = get_data("profiles", {"department": dept, "role": "staff"})
                    staff_ids = [s["id"] for s in dept_staff]
                    
                    if staff_ids:
                        assignments = get_data("issue_assignments", {"staff_id": staff_ids})
                        dept_issue_ids = list(set([a["issue_id"] for a in assignments]))
                        stats["issues_by_department"][dept] = len(dept_issue_ids)
                    else:
                        stats["issues_by_department"][dept] = 0
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get issue stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch statistics"
        )


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(
    issue_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """Get issue by ID."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        issues = get_data(
            "issues",
            {"id": issue_id},
            select_fields="*, profiles!citizen_id(full_name, phone)"
        )
        
        if not issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        issue = issues[0]
        
        # Permission check for citizens
        if user_role == "citizen" and issue["citizen_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this issue"
            )
        
        # Get user vote status
        user_vote_status = get_user_vote_status(user_id, [issue_id])
        
        # Process issue data
        issue_data = _process_issue_data(issue, user_vote_status)
        
        return IssueResponse(**issue_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch issue"
        )


@router.put("/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: int,
    issue_update: IssueUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update issue."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Check if issue exists
        existing_issues = get_data("issues", {"id": issue_id})
        if not existing_issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        # Delete related records first
        delete_data("issue_votes", {"issue_id": issue_id})
        delete_data("issue_updates", {"issue_id": issue_id})
        delete_data("issue_assignments", {"issue_id": issue_id})
        
        # Delete issue
        delete_data("issues", {"id": issue_id})
        
        logger.info(f"Issue {issue_id} deleted by admin {user_id}")
        return BaseResponse(success=True, message="Issue deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete issue"
        )


@router.post("/{issue_id}/vote", response_model=VoteResponse)
async def vote_issue(
    issue_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Vote on an issue (upvote)."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Check if issue exists
        issues = get_data("issues", {"id": issue_id})
        if not issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        # Check if user already voted
        existing_votes = get_data("issue_votes", {"issue_id": issue_id, "user_id": user_id})
        if existing_votes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already voted on this issue"
            )
        
        # Create vote
        vote_data = {
            "issue_id": issue_id,
            "user_id": user_id
        }
        
        result = insert_data("issue_votes", vote_data)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record vote"
            )
        
        # The upvote count is automatically updated by database trigger
        logger.info(f"User {user_id} voted on issue {issue_id}")
        return VoteResponse(**result[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to vote on issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record vote"
        )


@router.delete("/{issue_id}/vote")
async def unvote_issue(
    issue_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove vote from an issue."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Check if vote exists
        existing_votes = get_data("issue_votes", {"issue_id": issue_id, "user_id": user_id})
        if not existing_votes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vote not found"
            )
        
        # Delete vote
        delete_data("issue_votes", {"issue_id": issue_id, "user_id": user_id})
        
        # The upvote count is automatically updated by database trigger
        logger.info(f"User {user_id} removed vote from issue {issue_id}")
        return BaseResponse(success=True, message="Vote removed successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove vote from issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove vote"
        )


@router.get("/{issue_id}/votes")
async def get_issue_votes(
    issue_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get votes for an issue."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Check if issue exists
        issues = get_data("issues", {"id": issue_id})
        if not issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        # Get votes with user details
        votes, total = get_paginated_data(
            table="issue_votes",
            page=page,
            per_page=per_page,
            filters={"issue_id": issue_id},
            select_fields="*, profiles!user_id(full_name)",
            order_by="-created_at"
        )
        
        # Process votes data
        processed_votes = []
        for vote in votes:
            vote_data = {
                "issue_id": vote["issue_id"],
                "user_id": vote["user_id"],
                "created_at": vote["created_at"],
                "user_name": vote.get("profiles", {}).get("full_name", "Anonymous") if vote.get("profiles") else "Anonymous"
            }
            processed_votes.append(vote_data)
        
        # Pagination
        total_pages = math.ceil(total / per_page) if total > 0 else 1
        pagination = PaginationResponse(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
        return {
            "success": True,
            "votes": processed_votes,
            "pagination": pagination
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get votes for issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch votes"
        )


@router.get("/nearby")
async def get_nearby_issues(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius: float = Query(5.0, description="Search radius in kilometers"),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get issues near a specific location."""
    try:
        # This is a simplified version - for production, you'd want to use PostGIS or similar
        # for proper geographic queries
        
        filters = {
            "latitude": {"operator": "neq", "value": None},
            "longitude": {"operator": "neq", "value": None}
        }
        
        if category:
            filters["category"] = category
        if status:
            filters["status"] = status
        
        # Get all issues with location
        issues = get_data(
            "issues",
            filters=filters,
            select_fields="*, profiles!citizen_id(full_name, phone)",
            order_by="-created_at",
            limit=limit * 3  # Get more to account for distance filtering
        )
        
        # Simple distance calculation (Haversine formula would be better)
        nearby_issues = []
        for issue in issues:
            if issue["latitude"] and issue["longitude"]:
                # Simple distance approximation
                lat_diff = abs(latitude - issue["latitude"])
                lng_diff = abs(longitude - issue["longitude"])
                approx_distance = ((lat_diff ** 2) + (lng_diff ** 2)) ** 0.5 * 111  # Rough km conversion
                
                if approx_distance <= radius:
                    issue["distance"] = round(approx_distance, 2)
                    nearby_issues.append(issue)
        
        # Sort by distance and limit results
        nearby_issues.sort(key=lambda x: x.get("distance", 0))
        nearby_issues = nearby_issues[:limit]
        
        # Get user vote status if authenticated
        user_vote_status = {}
        if current_user:
            user_id = current_user["profile"]["id"]
            issue_ids = [issue["id"] for issue in nearby_issues]
            user_vote_status = get_user_vote_status(user_id, issue_ids)
        
        # Process issues data
        processed_issues = []
        for issue in nearby_issues:
            issue_data = _process_issue_data(issue, user_vote_status)
            processed_issues.append(IssueResponse(**issue_data))
        
        return {
            "success": True,
            "issues": processed_issues,
            "center": {"latitude": latitude, "longitude": longitude},
            "radius": radius,
            "total": len(processed_issues)
        }
        
    except Exception as e:
        logger.error(f"Failed to get nearby issues: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch nearby issues"
        )


@router.get("/camera/permissions")
async def check_camera_permissions(
    current_user: dict = Depends(get_current_user)
):
    """Check camera access permissions for authenticated user."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # All authenticated users can access camera
        permissions = {
            "camera_access": True,
            "upload_limit_mb": MAX_FILE_SIZE // (1024 * 1024),
            "allowed_formats": list(ALLOWED_IMAGE_TYPES),
            "compression_available": True,
            "user_id": user_id,
            "user_role": user_role,
            "authenticated": True,
            "message": "Camera access granted"
        }
        
        logger.info(f"Camera permissions checked for user {user_id} ({user_role})")
        return permissions
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check camera permissions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify camera permissions"
        )
        if not existing_issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        existing_issue = existing_issues[0]
        
        # Permission checks
        if user_role == "citizen":
            # Citizens can only update their own issues and only certain fields
            if existing_issue["citizen_id"] != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this issue"
                )
            # Citizens cannot change status
            if issue_update.status is not None:
                issue_update.status = None
        
        # Prepare update data
        update_dict = issue_update.dict(exclude_unset=True, exclude_none=True)
        
        if not update_dict:
            return IssueResponse(**_process_issue_data(existing_issue))
        
        # Add updated_at timestamp
        update_dict["updated_at"] = datetime.now().isoformat()
        
        # Update issue
        updated_issues = update_data("issues", {"id": issue_id}, update_dict)
        
        if not updated_issues:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update issue"
            )
        
        # Get updated issue with citizen info
        updated_issue = get_data(
            "issues",
            {"id": issue_id},
            select_fields="*, profiles!citizen_id(full_name, phone)"
        )
        
        if not updated_issue:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated issue"
            )
        
        # Get user vote status
        user_vote_status = get_user_vote_status(user_id, [issue_id])
        
        # Process issue data
        issue_data = _process_issue_data(updated_issue[0], user_vote_status)
        
        logger.info(f"Issue {issue_id} updated by {user_id}")
        return IssueResponse(**issue_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update issue"
        )


@router.delete("/{issue_id}")
async def delete_issue(
    issue_id: int,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """Delete issue (admin only)."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # Check if issue exists
        existing_issues = get_data("issues", {"id": issue_id})
        if not existing_issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        # Delete related records first (to maintain referential integrity)
        delete_data("issue_votes", {"issue_id": issue_id})
        delete_data("issue_updates", {"issue_id": issue_id})
        delete_data("issue_assignments", {"issue_id": issue_id})
        
        # Delete the main issue record
        delete_data("issues", {"id": issue_id})
        
        logger.info(f"Issue {issue_id} deleted by admin {user_id}")
        return BaseResponse(success=True, message="Issue deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete issue"
        )


# @router.get("/{issue_id}/votes")
# async def get_issue_votes(
#     issue_id: int,
#     page: int = Query(1, ge=1),
#     per_page: int = Query(20, ge=1, le=100),
#     current_user: dict = Depends(get_current_user)
# ):
#     """Get votes for an issue."""
#     try:
#         # Validate authentication
#         user_id, user_role = _validate_user_authentication(current_user)
        
#         # Check if issue exists
#         issues = get_data("issues", {"id": issue_id})
#         if not issues:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="Issue not found"
#             )
        
#         # Get votes with user details
#         votes, total = get_paginated_data(
#             table="issue_votes",
#             page=page,
#             per_page=per_page,
#             filters={"issue_id": issue_id},
#             select_fields="*, profiles!user_id(full_name)",
#             order_by="-created_at"
#         )
        
#         # Process votes data
#         processed_votes = []
#         for vote in votes:
#             vote_data = {
#                 "issue_id": vote["issue_id"],
#                 "user_id": vote["user_id"],
#                 "created_at": vote["created_at"],
#                 "user_name": vote.get("profiles", {}).get("full_name", "Anonymous") if vote.get("profiles") else "Anonymous"
#             }
#             processed_votes.append(vote_data)
        
#         # Pagination
#         total_pages = math.ceil(total / per_page) if total > 0 else 1
#         pagination = PaginationResponse(
#             total=total,
#             page=page,
#             per_page=per_page,
#             total_pages=total_pages,
#             has_next=page < total_pages,
#             has_prev=page > 1
#         )
        
#         return {
#             "success": True,
#             "votes": processed_votes,
#             "pagination": pagination
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Failed to get votes for issue {issue_id}: {str(e)}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to fetch votes"
#         )


@router.get("/nearby")
async def get_nearby_issues(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius: float = Query(5.0, description="Search radius in kilometers"),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get issues near a specific location."""
    try:
        # This is a simplified version - for production, you'd want to use PostGIS or similar
        # for proper geographic queries
        
        filters = {
            "latitude": {"operator": "neq", "value": None},
            "longitude": {"operator": "neq", "value": None}
        }
        
        if category:
            filters["category"] = category
        if status:
            filters["status"] = status
        
        # Get all issues with location
        issues = get_data(
            "issues",
            filters=filters,
            select_fields="*, profiles!citizen_id(full_name, phone)",
            order_by="-created_at",
            limit=limit * 3  # Get more to account for distance filtering
        )
        
        # Simple distance calculation (Haversine formula would be better)
        nearby_issues = []
        for issue in issues:
            if issue["latitude"] and issue["longitude"]:
                # Simple distance approximation
                lat_diff = abs(latitude - issue["latitude"])
                lng_diff = abs(longitude - issue["longitude"])
                approx_distance = ((lat_diff ** 2) + (lng_diff ** 2)) ** 0.5 * 111  # Rough km conversion
                
                if approx_distance <= radius:
                    issue["distance"] = round(approx_distance, 2)
                    nearby_issues.append(issue)
        
        # Sort by distance and limit results
        nearby_issues.sort(key=lambda x: x.get("distance", 0))
        nearby_issues = nearby_issues[:limit]
        
        # Get user vote status if authenticated
        user_vote_status = {}
        if current_user:
            user_id = current_user["profile"]["id"]
            issue_ids = [issue["id"] for issue in nearby_issues]
            user_vote_status = get_user_vote_status(user_id, issue_ids)
        
        # Process issues data
        processed_issues = []
        for issue in nearby_issues:
            issue_data = _process_issue_data(issue, user_vote_status)
            processed_issues.append(IssueResponse(**issue_data))
        
        return {
            "success": True,
            "issues": processed_issues,
            "center": {"latitude": latitude, "longitude": longitude},
            "radius": radius,
            "total": len(processed_issues)
        }
        
    except Exception as e:
        logger.error(f"Failed to get nearby issues: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch nearby issues"
        )


@router.get("/camera/permissions")
async def check_camera_permissions(
    current_user: dict = Depends(get_current_user)
):
    """Check camera access permissions for authenticated user."""
    try:
        # Validate authentication
        user_id, user_role = _validate_user_authentication(current_user)
        
        # All authenticated users can access camera
        permissions = {
            "camera_access": True,
            "upload_limit_mb": MAX_FILE_SIZE // (1024 * 1024),
            "allowed_formats": list(ALLOWED_IMAGE_TYPES),
            "compression_available": True,
            "user_id": user_id,
            "user_role": user_role,
            "authenticated": True,
            "message": "Camera access granted"
        }
        
        logger.info(f"Camera permissions checked for user {user_id} ({user_role})")
        return permissions
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check camera permissions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify camera permissions"
        )
@router.post("/predict-category-from-url")
async def predict_category_from_image_url(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Predict issue category from image URL using HuggingFace API."""
    try:
        import httpx
        from gradio_client import Client, handle_file
        import tempfile
        import os
        
        image_url = request.get("image_url")
        if not image_url:
            raise HTTPException(
                status_code=400,
                detail="image_url is required"
            )
        
        logger.info(f"🔄 Predicting category for image: {image_url}")
        
        # Download image from Supabase
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            img_response = await http_client.get(image_url)
            
            if img_response.status_code != 200:
                logger.error(f"Failed to download image: {img_response.status_code}")
                return {
                    "success": False,
                    "category": "potholes",
                    "confidence": 0.0,
                    "error": "Failed to download image"
                }
            
            image_bytes = img_response.content
            logger.info(f"✅ Image downloaded: {len(image_bytes)} bytes")
        
        # Save temporary file for Gradio client
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            tmp_file.write(image_bytes)
            tmp_path = tmp_file.name
        
        try:
            # Call HuggingFace Gradio API
            logger.info("🤖 Calling HuggingFace Gradio API...")
            client = Client("PatientZero6969/civic-issue-image-classifier")
            
            # ✅ CRITICAL FIX: Use handle_file() like in your test
            result = client.predict(
                image=handle_file(tmp_path),  # ✅ Using handle_file()
                api_name="/predict_issue"
            )
            
            logger.info(f"✅ ML Prediction result: {result}")
            
            # Parse the result (it's already in the correct format from your test)
            if isinstance(result, dict) and result.get("success"):
                return {
                    "success": True,
                    "category": result.get("category", "potholes"),
                    "confidence": result.get("confidence", 0.0),
                    "all_predictions": result.get("all_predictions", [])
                }
            else:
                logger.warning(f"Unexpected result format: {result}")
                return {
                    "success": False,
                    "category": "potholes",
                    "confidence": 0.0,
                    "error": "Unexpected response format"
                }
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                logger.info("🧹 Cleaned up temporary file")
                
    except Exception as e:
        logger.error(f"❌ Prediction failed: {str(e)}", exc_info=True)
        # Return fallback instead of raising exception
        return {
            "success": False,
            "category": "potholes",
            "confidence": 0.0,
            "error": str(e)
        }