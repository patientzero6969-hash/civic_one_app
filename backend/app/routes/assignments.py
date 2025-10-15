from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.supabase_client import (
    insert_data, get_data, update_data, delete_data,
    get_paginated_data, get_assignments_with_details
)
from app.schemas import (
    AssignmentCreate, AssignmentResponse, AssignmentUpdate,
    AssignmentListResponse, PaginationResponse, BaseResponse,
    BulkAssignRequest, BulkOperationResponse, EscalationRequest
)
from app.routes.auth import get_current_user, require_roles
from app.services.notification_service import NotificationService
from typing import List, Optional, Literal
import logging
import math
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter()


def _process_assignment_data(assignment_data: dict) -> dict:
    """Process raw assignment data to include additional fields."""
    # Handle staff profile data (now includes supervisors too)
    if assignment_data.get("staff"):
        staff_profile = assignment_data["staff"]
        assignment_data["staff_name"] = staff_profile.get("full_name")
        assignment_data["staff_department"] = staff_profile.get("department")
        assignment_data["staff_role"] = staff_profile.get("role")  # Include role
        del assignment_data["staff"]
    
    # Handle assigned_by profile data
    if assignment_data.get("assigned_by_profile"):
        assignment_data["assigned_by_name"] = assignment_data["assigned_by_profile"].get("full_name")
        del assignment_data["assigned_by_profile"]
    
    # Handle issue data
    if assignment_data.get("issues"):
        issue_data = assignment_data["issues"]
        assignment_data["issue_title"] = issue_data.get("title")
        assignment_data["issue_category"] = issue_data.get("category")
        del assignment_data["issues"]
    
    return assignment_data


def calculate_deadline(category: str, priority: str = "medium") -> datetime:
    """Calculate deadline based on category and priority."""
    sla_hours = {
        "potholes": {"low": 168, "medium": 72, "high": 24, "urgent": 4},
        "Garbage": {"low": 48, "medium": 24, "high": 8, "urgent": 2},
        "WaterLogging": {"low": 72, "medium": 48, "high": 12, "urgent": 4},
        "DamagedElectricalPoles": {"low": 120, "medium": 72, "high": 24, "urgent": 8},
        "FallenTrees": {"low": 168, "medium": 96, "high": 48, "urgent": 12}
    }
    
    hours = sla_hours.get(category, {}).get(priority, 72)
    return datetime.now() + timedelta(hours=hours)


@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    assignment: AssignmentCreate,
    current_user: dict = Depends(require_roles(["admin", "supervisor", "staff"]))
):
    """Create a new assignment (admin/supervisor/staff). Can assign to staff or supervisors."""
    try:
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        logger.info(f"Creating assignment - User: {user_id}, Role: {user_role}")
        logger.info(f"Assignment data: issue_id={assignment.issue_id}, staff_id={assignment.staff_id}")
        
        # Check if issue exists
        issues = get_data("issues", {"id": assignment.issue_id})
        if not issues:
            logger.error(f"Issue {assignment.issue_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        issue = issues[0]
        logger.info(f"Issue found: {issue.get('title')}")
        
        # Check if assignee exists
        assignee = get_data("profiles", {"id": assignment.staff_id})
        if not assignee:
            logger.error(f"Assignee {assignment.staff_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee not found"
            )
        
        assignee_profile = assignee[0]
        assignee_role = assignee_profile.get("role")
        assignee_name = assignee_profile.get("full_name")
        
        logger.info(f"Assignee found: {assignee_name}, Role: {assignee_role}")
        
        # Allow assignment to both staff and supervisors
        if assignee_role not in ["staff", "supervisor"]:
            logger.error(f"Invalid assignee role: {assignee_role}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only assign to staff members or supervisors"
            )
        
        # Staff-specific validation
        if user_role == "staff":
            logger.info("Validating staff assignment permissions")
            
            # Staff can only assign to supervisors (not other staff)
            if assignee_role != "supervisor":
                logger.error(f"Staff trying to assign to non-supervisor: {assignee_role}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Staff members can only assign tasks to supervisors"
                )
            
            # Staff can only assign to supervisors in their own department
            user_department = current_user["profile"].get("department")
            assignee_department = assignee_profile.get("department")
            
            logger.info(f"Department check - User: {user_department}, Assignee: {assignee_department}")
            
            if user_department != assignee_department:
                logger.error(f"Department mismatch: {user_department} != {assignee_department}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only assign to supervisors in your department"
                )
        
        # Check department permissions for supervisors
        if user_role == "supervisor":
            user_department = current_user["profile"].get("department")
            assignee_department = assignee_profile.get("department")
            
            if user_department != assignee_department:
                logger.error(f"Supervisor department mismatch")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign to users outside your department"
                )
        
        # Check if issue is already assigned to the same person
        existing_assignments = get_data("issue_assignments", {
            "issue_id": assignment.issue_id,
            "staff_id": assignment.staff_id,
            "status": ["assigned", "in_progress"]
        })
        
        if existing_assignments:
            logger.warning(f"Issue {assignment.issue_id} already assigned to {assignment.staff_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Issue is already assigned to this {assignee_role}"
            )
        
        # Set assigned_by to current user
        assignment_data = assignment.dict()
        assignment_data["assigned_by"] = user_id
        
        logger.info(f"Creating assignment in database: {assignment_data}")
        
        # Create assignment
        result = insert_data("issue_assignments", assignment_data)
        if not result:
            logger.error("Failed to insert assignment into database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create assignment"
            )
        
        logger.info(f"Assignment created successfully: {result[0].get('id')}")
        
        # Update issue status to in_progress if it was pending
        if issue["status"] == "pending":
            update_data("issues", {"id": assignment.issue_id}, {"status": "in_progress"})
            logger.info(f"Updated issue {assignment.issue_id} status to in_progress")
        
        # Get the created assignment with related data
        created_assignment = get_data(
            "issue_assignments",
            {"id": result[0]["id"]},
            select_fields="""
            *, 
            staff:profiles!staff_id(full_name, department, role),
            assigned_by_profile:profiles!assigned_by(full_name),
            issues!issue_id(title, category)
            """
        )
        
        if not created_assignment:
            logger.error("Failed to retrieve created assignment")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created assignment"
            )
        
        assignment_with_details = _process_assignment_data(created_assignment[0])
        
        logger.info(f"Assignment created: Issue {assignment.issue_id} assigned to {assignee_role} {assignment.staff_id}")
        
        # Send notification to assignee
        try:
            notification_service = NotificationService()
            await notification_service.notify_assignment_created(
                assignee_id=assignment.staff_id,
                issue_id=assignment.issue_id,
                assigned_by=user_id
            )
            logger.info("Notification sent successfully")
        except Exception as e:
            logger.warning(f"Failed to send notification: {str(e)}")
        
        return AssignmentResponse(**assignment_with_details)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create assignment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create assignment: {str(e)}"
        )


@router.post("/{assignment_id}/escalate", response_model=BaseResponse)
async def escalate_assignment(
    assignment_id: int,
    escalation: EscalationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Escalate an overdue assignment."""
    user_role = current_user["profile"]["role"]
    user_id = current_user["profile"]["id"]
    
    # Check if user can escalate
    if user_role not in ["admin", "supervisor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and admins can escalate assignments"
        )
    
    # Get assignment
    assignment = get_data("issue_assignments", {"id": assignment_id})
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Update assignment with new deadline
    new_deadline = datetime.now() + timedelta(hours=24)  # 24 hour extension
    update_data("issue_assignments", 
                {"id": assignment_id}, 
                {"deadline": new_deadline, "notes": f"Escalated: {escalation.reason}"})
    
    return BaseResponse(success=True, message="Assignment escalated successfully")


@router.get("/", response_model=AssignmentListResponse)
async def list_assignments(
    staff_id: Optional[str] = Query(None, description="Filter by staff ID"),
    issue_id: Optional[int] = Query(None, description="Filter by issue ID"),
    status_filter: Optional[Literal["assigned", "in_progress", "completed"]] = Query(None, alias="status"),
    department: Optional[str] = Query(None, description="Filter by department"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user)
):
    """List assignments with filtering and pagination."""
    try:
        filters = {}
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Role-based filtering
        if user_role == "staff":
            filters["staff_id"] = user_id
        elif user_role == "supervisor":
            # Supervisors can see assignments for themselves AND their department staff
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": ["staff", "supervisor"]})
            dept_staff_ids = [s["id"] for s in dept_staff]
            if dept_staff_ids:
                filters["staff_id"] = dept_staff_ids
            else:
                # No staff in department, return empty
                return AssignmentListResponse(
                    success=True,
                    assignments=[],
                    pagination=PaginationResponse(
                        total=0, page=page, per_page=per_page, 
                        total_pages=1, has_next=False, has_prev=False
                    )
                )
        elif staff_id:
            filters["staff_id"] = staff_id
        
        # Apply other filters
        if issue_id:
            filters["issue_id"] = issue_id
        if status_filter:
            filters["status"] = status_filter
        
        # Department filtering (admin only)
        if department and user_role == "admin":
            dept_staff = get_data("profiles", {"department": department, "role": ["staff", "supervisor"]})
            dept_staff_ids = [s["id"] for s in dept_staff]
            if dept_staff_ids:
                if "staff_id" in filters:
                    # Intersect with existing staff_id filter
                    if isinstance(filters["staff_id"], list):
                        filters["staff_id"] = [sid for sid in filters["staff_id"] if sid in dept_staff_ids]
                    else:
                        filters["staff_id"] = [filters["staff_id"]] if filters["staff_id"] in dept_staff_ids else []
                else:
                    filters["staff_id"] = dept_staff_ids
        
        # Get assignments with pagination
        assignments, total = get_assignments_with_details(
            filters=filters,
            page=page,
            per_page=per_page
        )
        
        # Process assignments data
        processed_assignments = []
        for assignment in assignments:
            assignment_data = _process_assignment_data(assignment)
            processed_assignments.append(AssignmentResponse(**assignment_data))
        
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
        
        logger.info(f"Listed {len(processed_assignments)} assignments for {user_role}")
        return AssignmentListResponse(
            success=True,
            assignments=processed_assignments,
            pagination=pagination
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch assignments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch assignments"
        )


@router.get("/my", response_model=AssignmentListResponse)
async def get_my_assignments(
    status_filter: Optional[Literal["assigned", "in_progress", "completed"]] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles(["staff", "supervisor"]))
):
    """Get current user's assignments (staff/supervisor)."""
    try:
        user_id = current_user["profile"]["id"]
        
        filters = {"staff_id": user_id}
        if status_filter:
            filters["status"] = status_filter
        
        assignments, total = get_assignments_with_details(
            filters=filters,
            page=page,
            per_page=per_page
        )
        
        processed_assignments = []
        for assignment in assignments:
            assignment_data = _process_assignment_data(assignment)
            processed_assignments.append(AssignmentResponse(**assignment_data))
        
        total_pages = math.ceil(total / per_page) if total > 0 else 1
        pagination = PaginationResponse(
            total=total, page=page, per_page=per_page, total_pages=total_pages,
            has_next=page < total_pages, has_prev=page > 1
        )
        
        return AssignmentListResponse(
            success=True,
            assignments=processed_assignments,
            pagination=pagination
        )
        
    except Exception as e:
        logger.error(f"Failed to get user assignments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch assignments"
        )


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """Get assignment by ID."""
    try:
        assignments = get_data(
            "issue_assignments",
            {"id": assignment_id},
            select_fields="""
            *, 
            staff:profiles!staff_id(full_name, department, role),
            assigned_by_profile:profiles!assigned_by(full_name),
            issues!issue_id(title, category)
            """
        )
        
        if not assignments:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        assignment = assignments[0]
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Permission check
        if user_role in ["staff", "supervisor"] and assignment["staff_id"] != user_id:
            # Check if supervisor can view staff's assignments in their department
            if user_role == "supervisor":
                staff_data = get_data("profiles", {"id": assignment["staff_id"]})
                if staff_data and staff_data[0].get("department") != current_user["profile"]["department"]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view assignments outside your department"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this assignment"
                )
        
        assignment_data = _process_assignment_data(assignment)
        return AssignmentResponse(**assignment_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch assignment {assignment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch assignment"
        )


@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    assignment_update: AssignmentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update assignment status."""
    try:
        # Check if assignment exists
        existing_assignments = get_data("issue_assignments", {"id": assignment_id})
        if not existing_assignments:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        existing_assignment = existing_assignments[0]
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Permission check
        if user_role in ["staff", "supervisor"] and existing_assignment["staff_id"] != user_id:
            if user_role == "supervisor":
                # Check if staff is in supervisor's department
                staff_data = get_data("profiles", {"id": existing_assignment["staff_id"]})
                if staff_data and staff_data[0].get("department") != current_user["profile"]["department"]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to update assignments outside your department"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this assignment"
                )
        
        # Update assignment
        update_dict = assignment_update.dict(exclude_unset=True)
        updated_assignments = update_data("issue_assignments", {"id": assignment_id}, update_dict)
        
        if not updated_assignments:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update assignment"
            )
        
        # Update issue status based on assignment status
        issue_id = existing_assignment["issue_id"]
        if assignment_update.status == "completed":
            # Check if all assignments for this issue are completed
            all_assignments = get_data("issue_assignments", {"issue_id": issue_id})
            all_completed = all(a["status"] == "completed" for a in all_assignments)
            
            if all_completed:
                update_data("issues", {"id": issue_id}, {"status": "resolved"})
        elif assignment_update.status == "in_progress":
            # Ensure issue is marked as in_progress
            update_data("issues", {"id": issue_id}, {"status": "in_progress"})
        
        # Get updated assignment with related data
        updated_assignment = get_data(
            "issue_assignments",
            {"id": assignment_id},
            select_fields="""
            *, 
            staff:profiles!staff_id(full_name, department, role),
            assigned_by_profile:profiles!assigned_by(full_name),
            issues!issue_id(title, category)
            """
        )
        
        if not updated_assignment:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated assignment"
            )
        
        assignment_data = _process_assignment_data(updated_assignment[0])
        
        logger.info(f"Assignment {assignment_id} updated by {user_id}")
        return AssignmentResponse(**assignment_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update assignment {assignment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update assignment"
        )


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: int, 
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Delete assignment (admin/supervisor only)."""
    try:
        user_role = current_user["profile"]["role"]
        
        # Check if assignment exists
        existing_assignments = get_data("issue_assignments", {"id": assignment_id})
        if not existing_assignments:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        assignment = existing_assignments[0]
        
        # Permission check for supervisors
        if user_role == "supervisor":
            staff_data = get_data("profiles", {"id": assignment["staff_id"]})
            if staff_data and staff_data[0].get("department") != current_user["profile"]["department"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete assignments outside your department"
                )
        
        # Delete assignment
        delete_data("issue_assignments", {"id": assignment_id})
        
        # Update issue status if no more assignments exist
        issue_id = assignment["issue_id"]
        remaining_assignments = get_data("issue_assignments", {"issue_id": issue_id})
        
        if not remaining_assignments:
            update_data("issues", {"id": issue_id}, {"status": "pending"})
        
        logger.info(f"Assignment {assignment_id} deleted by {current_user['profile']['id']}")
        return BaseResponse(success=True, message="Assignment deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete assignment {assignment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete assignment"
        )


@router.post("/bulk", response_model=BulkOperationResponse)
async def bulk_assign_issues(
    bulk_request: BulkAssignRequest,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Assign multiple issues to a single staff member or supervisor."""
    try:
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Validate assignee
        assignee = get_data("profiles", {"id": bulk_request.staff_id})
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee not found"
            )
        
        assignee_profile = assignee[0]
        assignee_role = assignee_profile.get("role")
        
        # Allow assignment to both staff and supervisors
        if assignee_role not in ["staff", "supervisor"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only assign to staff members or supervisors"
            )
        
        # Check department permissions for supervisors
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            assignee_department = assignee_profile.get("department")
            
            if user_department != assignee_department:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign to users outside your department"
                )
        
        processed = 0
        failed = 0
        errors = []
        
        for issue_id in bulk_request.issue_ids:
            try:
                # Check if issue exists
                issues = get_data("issues", {"id": issue_id})
                if not issues:
                    errors.append(f"Issue {issue_id} not found")
                    failed += 1
                    continue
                
                # Check if already assigned
                existing = get_data("issue_assignments", {
                    "issue_id": issue_id,
                    "staff_id": bulk_request.staff_id,
                    "status": ["assigned", "in_progress"]
                })
                
                if existing:
                    errors.append(f"Issue {issue_id} already assigned to this {assignee_role}")
                    failed += 1
                    continue
                
                # Create assignment
                assignment_data = {
                    "issue_id": issue_id,
                    "staff_id": bulk_request.staff_id,
                    "assigned_by": user_id,
                    "notes": bulk_request.notes
                }
                
                result = insert_data("issue_assignments", assignment_data)
                if result:
                    # Update issue status
                    issue = issues[0]
                    if issue["status"] == "pending":
                        update_data("issues", {"id": issue_id}, {"status": "in_progress"})
                    processed += 1
                    
                    # Send notification
                    try:
                        notification_service = NotificationService()
                        await notification_service.notify_assignment_created(
                            assignee_id=bulk_request.staff_id,
                            issue_id=issue_id,
                            assigned_by=user_id
                        )
                    except Exception as e:
                        logger.warning(f"Failed to send notification for issue {issue_id}: {str(e)}")
                else:
                    errors.append(f"Failed to assign issue {issue_id}")
                    failed += 1
                    
            except Exception as e:
                errors.append(f"Error assigning issue {issue_id}: {str(e)}")
                failed += 1
        
        message = f"Processed {processed} assignments to {assignee_role}"
        if failed > 0:
            message += f", {failed} failed"
        
        return BulkOperationResponse(
            success=True,
            message=message,
            processed=processed,
            failed=failed,
            errors=errors
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed bulk assignment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process bulk assignment"
        )


@router.get("/stats/workload")
async def get_workload_distribution(
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Get workload distribution across staff members and supervisors."""
    try:
        user_role = current_user["profile"]["role"]
        
        # Get staff members and supervisors based on role
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            assignable_users = get_data("profiles", {
                "role": ["staff", "supervisor"],
                "department": user_department
            })
        else:
            assignable_users = get_data("profiles", {"role": ["staff", "supervisor"]})
        
        if not assignable_users:
            return {
                "total_staff": 0,
                "total_supervisors": 0,
                "avg_workload": 0,
                "workload_distribution": []
            }
        
        workload_data = []
        total_active_assignments = 0
        staff_count = 0
        supervisor_count = 0
        
        for user in assignable_users:
            # Get active assignments
            active_assignments = get_data("issue_assignments", {
                "staff_id": user["id"],
                "status": ["assigned", "in_progress"]
            })
            
            total_assignments = get_data("issue_assignments", {"staff_id": user["id"]})
            completed_assignments = get_data("issue_assignments", {
                "staff_id": user["id"],
                "status": "completed"
            })
            
            active_count = len(active_assignments)
            total_active_assignments += active_count
            
            if user["role"] == "staff":
                staff_count += 1
            elif user["role"] == "supervisor":
                supervisor_count += 1
            
            workload_data.append({
                "user_id": user["id"],
                "name": user.get("full_name", "Unknown"),
                "role": user["role"],
                "department": user.get("department", "Unknown"),
                "active_assignments": active_count,
                "total_assignments": len(total_assignments),
                "completed_assignments": len(completed_assignments),
                "completion_rate": round(
                    (len(completed_assignments) / len(total_assignments) * 100) if total_assignments else 0, 
                    1
                )
            })
        
        avg_workload = round(total_active_assignments / len(assignable_users), 1) if assignable_users else 0
        
        # Sort by active assignments (highest first)
        workload_data.sort(key=lambda x: x["active_assignments"], reverse=True)
        
        return {
            "total_staff": staff_count,
            "total_supervisors": supervisor_count,
            "total_active_assignments": total_active_assignments,
            "avg_workload": avg_workload,
            "workload_distribution": workload_data
        }
        
    except Exception as e:
        logger.error(f"Failed to get workload distribution: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch workload distribution"
        )


@router.get("/assignable-users", response_model=List[dict])
async def get_assignable_users(
    department: Optional[str] = Query(None, description="Filter by department"),
    role: Optional[str] = Query(None, description="Filter by role (staff/supervisor)"),
    current_user: dict = Depends(require_roles(["admin", "supervisor", "staff"]))
):
    """Get list of users that can be assigned tasks (staff and supervisors)."""
    try:
        user_role = current_user["profile"]["role"]
        
        # Base filter - can assign to both staff and supervisors
        if role and role in ["staff", "supervisor"]:
            filters = {"role": [role]}
        else:
            filters = {"role": ["staff", "supervisor"]}
        
        # Staff can only see supervisors in their department
        if user_role == "staff":
            user_department = current_user["profile"]["department"]
            if user_department:
                filters["department"] = user_department
                filters["role"] = ["supervisor"]  # Staff can only assign to supervisors
        # Supervisors can only see users in their department
        elif user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            if user_department:
                filters["department"] = user_department
        # Admin can optionally filter by department
        elif department:
            filters["department"] = department
        
        assignable_users = get_data("profiles", filters=filters, order_by="full_name")
        
        # Add workload information for each user
        users_with_workload = []
        for user in assignable_users:
            # Get active assignments count
            active_assignments = get_data(
                "issue_assignments",
                {"staff_id": user["id"], "status": ["assigned", "in_progress"]}
            )
            
            users_with_workload.append({
                "id": user["id"],
                "full_name": user["full_name"],
                "role": user["role"],
                "department": user.get("department"),
                "active_assignments": len(active_assignments),
                "is_available": len(active_assignments) < 10  # Consider available if < 10 active tasks
            })
        
        logger.info(f"Listed {len(users_with_workload)} assignable users for {user_role}")
        return users_with_workload
        
    except Exception as e:
        logger.error(f"Failed to fetch assignable users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch assignable users"
        )


@router.get("/stats/department")
async def get_department_assignment_stats(
    department: Optional[str] = Query(None, description="Department filter"),
    current_user: dict = Depends(require_roles(["admin", "supervisor", "staff"]))
):
    """Get assignment statistics by department."""
    try:
        user_role = current_user["profile"]["role"]
        
        # Filter by department for supervisors and staff
        if user_role in ["supervisor", "staff"]:
            department = current_user["profile"]["department"]
        
        # Get assignable users (staff and supervisors) in department(s)
        filters = {"role": ["staff", "supervisor"]}
        if department:
            filters["department"] = department
        
        assignable_users = get_data("profiles", filters=filters)
        user_ids = [u["id"] for u in assignable_users]
        
        if not user_ids:
            return {
                "department": department or "All Departments",
                "total_staff": 0,
                "total_supervisors": 0,
                "assignment_stats": {
                    "total_assignments": 0,
                    "assigned": 0,
                    "in_progress": 0,
                    "completed": 0
                },
                "user_workload": []
            }
        
        # Get all assignments for these users
        all_assignments = get_data("issue_assignments", {"staff_id": user_ids})
        
        # Calculate stats
        assignment_stats = {
            "total_assignments": len(all_assignments),
            "assigned": len([a for a in all_assignments if a["status"] == "assigned"]),
            "in_progress": len([a for a in all_assignments if a["status"] == "in_progress"]),
            "completed": len([a for a in all_assignments if a["status"] == "completed"])
        }
        
        # Calculate individual user workload
        user_workload = []
        staff_count = 0
        supervisor_count = 0
        
        for user in assignable_users:
            user_assignments = [a for a in all_assignments if a["staff_id"] == user["id"]]
            
            if user["role"] == "staff":
                staff_count += 1
            elif user["role"] == "supervisor":
                supervisor_count += 1
            
            user_workload.append({
                "user_id": user["id"],
                "name": user.get("full_name", "Unknown"),
                "role": user["role"],
                "total_assignments": len(user_assignments),
                "active_assignments": len([a for a in user_assignments if a["status"] in ["assigned", "in_progress"]]),
                "completed_assignments": len([a for a in user_assignments if a["status"] == "completed"])
            })
        
        return {
            "department": department or "All Departments",
            "total_staff": staff_count,
            "total_supervisors": supervisor_count,
            "assignment_stats": assignment_stats,
            "user_workload": sorted(user_workload, key=lambda x: x["active_assignments"], reverse=True)
        }
        
    except Exception as e:
        logger.error(f"Failed to get department assignment stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch department statistics"
        )