from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.supabase_client import (
    insert_data, get_data, update_data, delete_data,
    get_updates_with_details
)
from app.schemas import (
    IssueUpdateCreate, IssueUpdateResponse, IssueUpdateListResponse,
    BaseResponse
)
from app.routes.auth import get_current_user, require_roles
from app.services.notification_service import NotificationService
from typing import List, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()


def _process_update_data(update_data: dict) -> dict:
    """Process raw update data to include additional fields."""
    # Handle staff profile data
    if update_data.get("profiles"):
        update_data["staff_name"] = update_data["profiles"].get("full_name")
        update_data["staff_department"] = update_data["profiles"].get("department")
        del update_data["profiles"]
    
    # Handle issue data
    if update_data.get("issues"):
        update_data["issue_title"] = update_data["issues"].get("title")
        update_data["issue_category"] = update_data["issues"].get("category")
        del update_data["issues"]
    
    return update_data


@router.post("/", response_model=IssueUpdateResponse, status_code=status.HTTP_201_CREATED)
async def create_issue_update(
    update: IssueUpdateCreate, 
    current_user: dict = Depends(get_current_user)
):
    """Create a new issue update."""
    try:
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Only staff, supervisors, and admins can create updates
        if user_role not in ["staff", "admin", "supervisor"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to create updates"
            )
        
        # Check if issue exists
        issues = get_data("issues", {"id": update.issue_id})
        if not issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        issue = issues[0]
        
        # For staff, check if they are assigned to this issue
        if user_role == "staff":
            assignments = get_data("issue_assignments", {
                "issue_id": update.issue_id,
                "staff_id": user_id
            })
            if not assignments:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not assigned to this issue"
                )
        
        # For supervisors, check if the issue is assigned to staff in their department
        elif user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            assignments = get_data("issue_assignments", {"issue_id": update.issue_id})
            
            if assignments:
                # Check if any assigned staff is in supervisor's department
                assigned_staff_ids = [a["staff_id"] for a in assignments]
                assigned_staff = get_data("profiles", {"id": assigned_staff_ids})
                
                if not any(s.get("department") == user_department for s in assigned_staff):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Issue is not assigned to staff in your department"
                    )
            else:
                # Issue not assigned yet, supervisor can still add updates
                pass
        
        # Set staff_id to current user
        update_data = update.dict()
        update_data["staff_id"] = user_id
        
        # Create update
        result = insert_data("issue_updates", update_data)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create update"
            )
        
        # Update the issue's updated_at timestamp
        update_data("issues", {"id": update.issue_id}, {
            "updated_at": datetime.now().isoformat()
        })
        
        # Get the created update with staff info
        created_update = get_data(
            "issue_updates",
            {"id": result[0]["id"]},
            select_fields="*, profiles!staff_id(full_name, department), issues!issue_id(title, category)"
        )
        
        if not created_update:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created update"
            )
        
        update_response_data = _process_update_data(created_update[0])
        
        # Send notification to citizen
        try:
            citizen_data = get_data("profiles", {"id": issue["citizen_id"]})
            if citizen_data:
                NotificationService.notify_issue_updated(
                    issue, update_response_data, citizen_data[0]
                )
        except Exception as e:
            logger.warning(f"Failed to send update notification: {str(e)}")
        
        logger.info(f"Issue update created: {result[0]['id']} for issue {update.issue_id} by {user_id}")
        return IssueUpdateResponse(**update_response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create update"
        )


@router.get("/", response_model=IssueUpdateListResponse)
async def list_updates(
    issue_id: Optional[int] = Query(None, description="Filter by issue ID"),
    staff_id: Optional[str] = Query(None, description="Filter by staff ID"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user)
):
    """List issue updates with filtering and pagination."""
    try:
        filters = {}
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Role-based filtering
        if user_role == "citizen":
            # Citizens can only see updates for their own issues
            if issue_id:
                citizen_issues = get_data("issues", {"id": issue_id, "citizen_id": user_id})
                if not citizen_issues:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view updates for this issue"
                    )
                filters["issue_id"] = issue_id
            else:
                # Get all citizen's issues and filter updates
                citizen_issues = get_data("issues", {"citizen_id": user_id})
                citizen_issue_ids = [i["id"] for i in citizen_issues]
                if citizen_issue_ids:
                    filters["issue_id"] = citizen_issue_ids
                else:
                    # No issues, return empty list
                    return IssueUpdateListResponse(
                        success=True,
                        updates=[]
                    )
        
        elif user_role == "staff":
            # Staff can see updates for issues they're assigned to, or their own updates
            if staff_id and staff_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Staff can only view their own updates"
                )
            
            if issue_id:
                # Check if staff is assigned to this issue or created updates for it
                assignments = get_data("issue_assignments", {"issue_id": issue_id, "staff_id": user_id})
                updates_by_user = get_data("issue_updates", {"issue_id": issue_id, "staff_id": user_id})
                
                if not assignments and not updates_by_user:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view updates for this issue"
                    )
                filters["issue_id"] = issue_id
            else:
                # Show updates for issues they're assigned to or updates they created
                assigned_issues = get_data("issue_assignments", {"staff_id": user_id})
                assigned_issue_ids = [a["issue_id"] for a in assigned_issues]
                
                # Also include issues they've created updates for
                their_updates = get_data("issue_updates", {"staff_id": user_id})
                update_issue_ids = [u["issue_id"] for u in their_updates]
                
                all_issue_ids = list(set(assigned_issue_ids + update_issue_ids))
                if all_issue_ids:
                    filters["issue_id"] = all_issue_ids
                else:
                    return IssueUpdateListResponse(success=True, updates=[])
        
        elif user_role == "supervisor":
            # Supervisors can see updates for issues assigned to staff in their department
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
            dept_staff_ids = [s["id"] for s in dept_staff]
            
            if issue_id:
                filters["issue_id"] = issue_id
            
            if staff_id:
                # Check if staff is in supervisor's department
                staff_data = get_data("profiles", {"id": staff_id})
                if not staff_data or staff_data[0].get("department") != user_department:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view updates for staff outside your department"
                    )
                filters["staff_id"] = staff_id
        
        else:  # admin
            if issue_id:
                filters["issue_id"] = issue_id
            if staff_id:
                filters["staff_id"] = staff_id
        
        # Get updates with pagination
        updates, total = get_updates_with_details(
            filters=filters,
            page=page,
            per_page=per_page
        )
        
        # Process updates data
        processed_updates = []
        for update in updates:
            update_data = _process_update_data(update)
            processed_updates.append(IssueUpdateResponse(**update_data))
        
        logger.info(f"Listed {len(processed_updates)} updates for {user_role}")
        return IssueUpdateListResponse(
            success=True,
            updates=processed_updates
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch updates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch updates"
        )


@router.get("/recent", response_model=IssueUpdateListResponse)
async def get_recent_updates(
    limit: int = Query(10, ge=1, le=50, description="Number of recent updates"),
    current_user: dict = Depends(get_current_user)
):
    """Get recent updates based on user role."""
    try:
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        filters = {}
        
        # Role-based filtering for recent updates
        if user_role == "citizen":
            # Get updates for citizen's issues
            citizen_issues = get_data("issues", {"citizen_id": user_id})
            citizen_issue_ids = [i["id"] for i in citizen_issues]
            if citizen_issue_ids:
                filters["issue_id"] = citizen_issue_ids
            else:
                return IssueUpdateListResponse(success=True, updates=[])
        
        elif user_role == "staff":
            # Get updates for assigned issues or updates created by staff
            assigned_issues = get_data("issue_assignments", {"staff_id": user_id})
            assigned_issue_ids = [a["issue_id"] for a in assigned_issues]
            
            their_updates = get_data("issue_updates", {"staff_id": user_id})
            update_issue_ids = [u["issue_id"] for u in their_updates]
            
            all_issue_ids = list(set(assigned_issue_ids + update_issue_ids))
            if all_issue_ids:
                filters["issue_id"] = all_issue_ids
            else:
                return IssueUpdateListResponse(success=True, updates=[])
        
        elif user_role == "supervisor":
            # Get updates for issues in supervisor's department
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
            dept_staff_ids = [s["id"] for s in dept_staff]
            
            if dept_staff_ids:
                # Get issues assigned to department staff
                dept_assignments = get_data("issue_assignments", {"staff_id": dept_staff_ids})
                dept_issue_ids = list(set([a["issue_id"] for a in dept_assignments]))
                if dept_issue_ids:
                    filters["issue_id"] = dept_issue_ids
                else:
                    return IssueUpdateListResponse(success=True, updates=[])
            else:
                return IssueUpdateListResponse(success=True, updates=[])
        
        # Get recent updates
        updates = get_data(
            "issue_updates",
            filters=filters,
            select_fields="*, profiles!staff_id(full_name, department), issues!issue_id(title, category)",
            order_by="-created_at",
            limit=limit
        )
        
        # Process updates data
        processed_updates = []
        for update in updates:
            update_data = _process_update_data(update)
            processed_updates.append(IssueUpdateResponse(**update_data))
        
        return IssueUpdateListResponse(
            success=True,
            updates=processed_updates
        )
        
    except Exception as e:
        logger.error(f"Failed to get recent updates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch recent updates"
        )


@router.get("/{update_id}", response_model=IssueUpdateResponse)
async def get_update(
    update_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """Get update by ID."""
    try:
        updates = get_data(
            "issue_updates",
            {"id": update_id},
            select_fields="*, profiles!staff_id(full_name, department), issues!issue_id(title, category)"
        )
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Update not found"
            )
        
        update = updates[0]
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Permission checks
        if user_role == "citizen":
            # Citizens can only see updates for their own issues
            issue_data = get_data("issues", {"id": update["issue_id"], "citizen_id": user_id})
            if not issue_data:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this update"
                )
        
        elif user_role == "staff":
            # Staff can see updates for issues they're assigned to or updates they created
            is_assigned = get_data("issue_assignments", {
                "issue_id": update["issue_id"],
                "staff_id": user_id
            })
            is_author = update["staff_id"] == user_id
            
            if not is_assigned and not is_author:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this update"
                )
        
        elif user_role == "supervisor":
            # Check if update is from staff in supervisor's department
            user_department = current_user["profile"]["department"]
            update_author = get_data("profiles", {"id": update["staff_id"]})
            
            if update_author and update_author[0].get("department") != user_department:
                # Also check if issue is assigned to staff in their department
                assignments = get_data("issue_assignments", {"issue_id": update["issue_id"]})
                if assignments:
                    assigned_staff_ids = [a["staff_id"] for a in assignments]
                    assigned_staff = get_data("profiles", {"id": assigned_staff_ids})
                    
                    if not any(s.get("department") == user_department for s in assigned_staff):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Not authorized to view this update"
                        )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view this update"
                    )
        
        update_data = _process_update_data(update)
        return IssueUpdateResponse(**update_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch update {update_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch update"
        )


@router.delete("/{update_id}")
async def delete_update(
    update_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """Delete update (admin/supervisor or update author only)."""
    try:
        # Check if update exists
        existing_updates = get_data("issue_updates", {"id": update_id})
        if not existing_updates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Update not found"
            )
        
        update = existing_updates[0]
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Permission check
        if user_role == "admin":
            # Admins can delete any update
            pass
        elif user_role == "supervisor":
            # Supervisors can delete updates from staff in their department
            user_department = current_user["profile"]["department"]
            update_author = get_data("profiles", {"id": update["staff_id"]})
            
            if not update_author or update_author[0].get("department") != user_department:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this update"
                )
        elif update["staff_id"] == user_id:
            # Users can delete their own updates
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this update"
            )
        
        # Delete update
        delete_data("issue_updates", {"id": update_id})
        
        logger.info(f"Update {update_id} deleted by {user_id}")
        return BaseResponse(success=True, message="Update deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete update {update_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete update"
        )


@router.get("/issue/{issue_id}", response_model=IssueUpdateListResponse)
async def get_updates_for_issue(
    issue_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all updates for a specific issue."""
    try:
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Check if issue exists and user has permission to view it
        issues = get_data("issues", {"id": issue_id})
        if not issues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue not found"
            )
        
        issue = issues[0]
        
        # Permission check based on role
        if user_role == "citizen" and issue["citizen_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view updates for this issue"
            )
        elif user_role == "staff":
            # Check if staff is assigned to this issue
            assignments = get_data("issue_assignments", {"issue_id": issue_id, "staff_id": user_id})
            if not assignments:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view updates for this issue"
                )
        elif user_role == "supervisor":
            # Check if issue is assigned to staff in supervisor's department
            user_department = current_user["profile"]["department"]
            assignments = get_data("issue_assignments", {"issue_id": issue_id})
            
            if assignments:
                assigned_staff_ids = [a["staff_id"] for a in assignments]
                assigned_staff = get_data("profiles", {"id": assigned_staff_ids})
                
                if not any(s.get("department") == user_department for s in assigned_staff):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view updates for this issue"
                    )
        
        # Get updates for the issue
        updates = get_data(
            "issue_updates",
            {"issue_id": issue_id},
            select_fields="*, profiles!staff_id(full_name, department), issues!issue_id(title, category)",
            order_by="-created_at"
        )
        
        # Process updates data
        processed_updates = []
        for update in updates:
            update_data = _process_update_data(update)
            processed_updates.append(IssueUpdateResponse(**update_data))
        
        return IssueUpdateListResponse(
            success=True,
            updates=processed_updates
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get updates for issue {issue_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch updates for issue"
        )


@router.get("/stats/activity")
async def get_update_activity_stats(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user: dict = Depends(require_roles(["admin", "supervisor", "staff"]))
):
    """Get update activity statistics."""
    try:
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Calculate date range
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        filters = {
            "created_at": {"operator": "gte", "value": start_date.isoformat()}
        }
        
        # Role-based filtering
        if user_role == "staff":
            filters["staff_id"] = user_id
        elif user_role == "supervisor":
            # Get staff in supervisor's department
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
            dept_staff_ids = [s["id"] for s in dept_staff]
            
            if dept_staff_ids:
                filters["staff_id"] = dept_staff_ids
            else:
                # No staff in department
                return {
                    "period_days": days,
                    "total_updates": 0,
                    "updates_by_staff": [],
                    "daily_activity": []
                }
        
        # Get updates in the specified period
        updates = get_data(
            "issue_updates",
            filters=filters,
            select_fields="*, profiles!staff_id(full_name, department)"
        )
        
        # Calculate statistics
        total_updates = len(updates)
        
        # Updates by staff
        staff_activity = {}
        for update in updates:
            staff_id = update["staff_id"]
            staff_name = update.get("profiles", {}).get("full_name", "Unknown") if update.get("profiles") else "Unknown"
            
            if staff_id not in staff_activity:
                staff_activity[staff_id] = {
                    "staff_id": staff_id,
                    "name": staff_name,
                    "update_count": 0
                }
            staff_activity[staff_id]["update_count"] += 1
        
        updates_by_staff = sorted(
            list(staff_activity.values()),
            key=lambda x: x["update_count"],
            reverse=True
        )
        
        # Daily activity (simplified - you might want to use proper date grouping)
        daily_activity = {}
        for update in updates:
            date_str = update["created_at"][:10]  # Get date part
            daily_activity[date_str] = daily_activity.get(date_str, 0) + 1
        
        daily_activity_list = [
            {"date": date, "count": count}
            for date, count in sorted(daily_activity.items())
        ]
        
        return {
            "period_days": days,
            "total_updates": total_updates,
            "avg_updates_per_day": round(total_updates / days, 1) if days > 0 else 0,
            "updates_by_staff": updates_by_staff,
            "daily_activity": daily_activity_list
        }
        
    except Exception as e:
        logger.error(f"Failed to get update activity stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch update activity statistics"
        )