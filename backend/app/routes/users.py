from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.supabase_client import get_data, update_data, get_paginated_data, search_data
from app.schemas import (
    ProfileResponse, ProfileUpdate, PaginationResponse, 
    BaseResponse
)
from app.routes.auth import get_current_user, require_roles
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[ProfileResponse])
async def list_users(
    role: Optional[str] = Query(None, description="Filter by role"),
    department: Optional[str] = Query(None, description="Filter by department"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """List users with filtering and pagination (admin/supervisor only)."""
    try:
        filters = {}
        user_role = current_user["profile"]["role"]
        
        # Supervisors can only see users in their department
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            if user_department:
                filters["department"] = user_department
        
        # Apply filters
        if role:
            filters["role"] = role
        if department and user_role == "admin":  # Only admins can filter by any department
            filters["department"] = department
        
        # Search functionality
        if search:
            users = search_data(
                table="profiles",
                search_fields=["full_name", "phone"],
                search_term=search,
                filters=filters,
                order_by="-created_at"
            )
            total = len(users)
            # Manual pagination for search results
            start = (page - 1) * per_page
            end = start + per_page
            paginated_users = users[start:end]
        else:
            paginated_users, total = get_paginated_data(
                table="profiles",
                page=page,
                per_page=per_page,
                filters=filters,
                order_by="-created_at"
            )
        
        logger.info(f"Listed {len(paginated_users)} users for {current_user['profile']['role']}")
        return [ProfileResponse(**user) for user in paginated_users]
        
    except Exception as e:
        logger.error(f"Failed to list users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users"
        )


@router.get("/staff", response_model=List[ProfileResponse])
async def list_staff_users(
    department: Optional[str] = Query(None, description="Filter by department"),
    available_only: bool = Query(False, description="Show only available staff"),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """List staff users for assignment purposes."""
    try:
        filters = {"role": "staff"}
        user_role = current_user["profile"]["role"]
        
        # Supervisors can only see staff in their department
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            if user_department:
                filters["department"] = user_department
        elif department:
            filters["department"] = department
        
        staff = get_data("profiles", filters=filters, order_by="full_name")
        
        # If available_only is True, filter out staff with too many active assignments
        if available_only:
            available_staff = []
            for staff_member in staff:
                # Get active assignments count
                active_assignments = get_data(
                    "issue_assignments",
                    {"staff_id": staff_member["id"], "status": ["assigned", "in_progress"]}
                )
                # Consider staff available if they have less than 5 active assignments
                if len(active_assignments) < 5:
                    staff_member["active_assignments"] = len(active_assignments)
                    available_staff.append(staff_member)
            staff = available_staff
        
        logger.info(f"Listed {len(staff)} staff members")
        return [ProfileResponse(**user) for user in staff]
        
    except Exception as e:
        logger.error(f"Failed to fetch staff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch staff"
        )
@router.get("/supervisors", response_model=List[ProfileResponse])
async def list_supervisors(
    department: Optional[str] = Query(None, description="Filter by department"),
    available_only: bool = Query(False, description="Show only available supervisors"),
    current_user: dict = Depends(require_roles(["admin", "staff"]))
):
    """List supervisors for assignment purposes."""
    try:
        filters = {"role": "supervisor"}
        user_role = current_user["profile"]["role"]
        
        # Staff can only see supervisors in their department
        if user_role == "staff":
            user_department = current_user["profile"]["department"]
            if user_department:
                filters["department"] = user_department
        elif department:
            filters["department"] = department
        
        supervisors = get_data("profiles", filters=filters, order_by="full_name")
        
        # If available_only is True, filter out supervisors with too many active assignments
        if available_only:
            available_supervisors = []
            for supervisor in supervisors:
                # Get active assignments count
                active_assignments = get_data(
                    "issue_assignments",
                    {"staff_id": supervisor["id"], "status": ["assigned", "in_progress"]}
                )
                # Consider supervisor available if they have less than 10 active assignments
                if len(active_assignments) < 10:
                    supervisor["active_assignments"] = len(active_assignments)
                    supervisor["total_assignments"] = len(get_data(
                        "issue_assignments",
                        {"staff_id": supervisor["id"]}
                    ))
                    available_supervisors.append(supervisor)
            supervisors = available_supervisors
        else:
            # Add assignment counts for all supervisors
            for supervisor in supervisors:
                active_assignments = get_data(
                    "issue_assignments",
                    {"staff_id": supervisor["id"], "status": ["assigned", "in_progress"]}
                )
                supervisor["active_assignments"] = len(active_assignments)
                supervisor["total_assignments"] = len(get_data(
                    "issue_assignments",
                    {"staff_id": supervisor["id"]}
                ))
        
        logger.info(f"Listed {len(supervisors)} supervisors")
        return [ProfileResponse(**user) for user in supervisors]
        
    except Exception as e:
        logger.error(f"Failed to fetch supervisors: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch supervisors"
        )

@router.get("/departments", response_model=List[str])
async def list_departments(
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Get list of all departments."""
    try:
        departments = get_data(
            "profiles",
            select_fields="DISTINCT department",
            filters={"role": {"operator": "in", "value": ["staff", "supervisor", "admin"]}}
        )
        
        dept_list = [dept["department"] for dept in departments if dept["department"]]
        dept_list = list(set(dept_list))  # Remove duplicates
        dept_list.sort()
        
        return dept_list
        
    except Exception as e:
        logger.error(f"Failed to fetch departments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch departments"
        )


@router.get("/stats")
async def get_user_stats(
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Get user statistics."""
    try:
        user_role = current_user["profile"]["role"]
        
        # Base stats
        stats = {
            "total_users": 0,
            "citizens": 0,
            "staff": 0,
            "supervisors": 0,
            "admins": 0,
            "users_by_department": {}
        }
        
        # If supervisor, limit to their department
        filters = {}
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            if user_department:
                filters["department"] = user_department
        
        # Get all users
        if filters:
            all_users = get_data("profiles", filters=filters)
        else:
            all_users = get_data("profiles")
        
        # Calculate stats
        stats["total_users"] = len(all_users)
        
        for user in all_users:
            role = user.get("role", "citizen")
            department = user.get("department", "None")
            
            # Count by role
            if role == "citizen":
                stats["citizens"] += 1
            elif role == "staff":
                stats["staff"] += 1
            elif role == "supervisor":
                stats["supervisors"] += 1
            elif role == "admin":
                stats["admins"] += 1
            
            # Count by department
            if department not in stats["users_by_department"]:
                stats["users_by_department"][department] = 0
            stats["users_by_department"][department] += 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get user stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user statistics"
        )


@router.get("/{user_id}", response_model=ProfileResponse)
async def get_user(
    user_id: str, 
    current_user: dict = Depends(get_current_user)
):
    """Get user by ID."""
    try:
        user_role = current_user["profile"]["role"]
        current_user_id = current_user["profile"]["id"]
        
        # Permission check: users can view their own profile, admin/supervisor can view others
        if user_role not in ["admin", "supervisor"] and current_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this user"
            )
        
        # Supervisors can only view users in their department
        if user_role == "supervisor" and current_user_id != user_id:
            user_department = current_user["profile"]["department"]
            target_user = get_data("profiles", {"id": user_id})
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            if target_user[0].get("department") != user_department:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view users outside your department"
                )
        
        users = get_data("profiles", {"id": user_id})
        if not users:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return ProfileResponse(**users[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user"
        )


@router.put("/{user_id}", response_model=ProfileResponse)
async def update_user(
    user_id: str,
    profile_update: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile."""
    try:
        user_role = current_user["profile"]["role"]
        current_user_id = current_user["profile"]["id"]
        
        # Permission check: users can update their own profile, admins can update any
        if user_role not in ["admin"] and current_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this user"
            )
        
        # Check if user exists
        existing_users = get_data("profiles", {"id": user_id})
        if not existing_users:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Prepare update data
        update_dict = profile_update.dict(exclude_unset=True, exclude_none=True)
        
        # Regular users cannot change their department
        if user_role != "admin" and "department" in update_dict:
            del update_dict["department"]
        
        if not update_dict:
            return ProfileResponse(**existing_users[0])
        
        # Update user
        updated_users = update_data("profiles", {"id": user_id}, update_dict)
        
        if not updated_users:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user"
            )
        
        logger.info(f"User {user_id} updated by {current_user_id}")
        return ProfileResponse(**updated_users[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


@router.get("/{user_id}/workload")
async def get_user_workload(
    user_id: str,
    current_user: dict = Depends(require_roles(["admin", "supervisor", "staff"]))
):
    """Get workload information for a user (staff only)."""
    try:
        user_role = current_user["profile"]["role"]
        current_user_id = current_user["profile"]["id"]
        
        # Permission check
        if user_role == "staff" and current_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff can only view their own workload"
            )
        
        # Check if target user is staff
        target_user = get_data("profiles", {"id": user_id})
        if not target_user or target_user[0].get("role") != "staff":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found"
            )
        
        # Get assignments
        all_assignments = get_data("issue_assignments", {"staff_id": user_id})
        active_assignments = get_data(
            "issue_assignments",
            {"staff_id": user_id, "status": ["assigned", "in_progress"]}
        )
        completed_assignments = get_data(
            "issue_assignments",
            {"staff_id": user_id, "status": "completed"}
        )
        
        # Get recent updates
        recent_updates = get_data(
            "issue_updates",
            {"staff_id": user_id},
            order_by="-created_at",
            limit=10
        )
        
        workload_data = {
            "user_id": user_id,
            "full_name": target_user[0].get("full_name"),
            "department": target_user[0].get("department"),
            "total_assignments": len(all_assignments),
            "active_assignments": len(active_assignments),
            "completed_assignments": len(completed_assignments),
            "recent_updates_count": len(recent_updates),
            "assignments": [
                {
                    "id": assignment["id"],
                    "issue_id": assignment["issue_id"],
                    "status": assignment["status"],
                    "assigned_at": assignment["assigned_at"]
                }
                for assignment in active_assignments[:5]  # Show top 5 active
            ]
        }
        
        return workload_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workload for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch workload information"
        )


@router.post("/{user_id}/change-role", response_model=ProfileResponse)
async def change_user_role(
    user_id: str,
    new_role: str,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """Change user role (admin only)."""
    try:
        # Validate role
        valid_roles = ["citizen", "staff", "supervisor", "admin"]
        if new_role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        
        # Check if user exists
        existing_users = get_data("profiles", {"id": user_id})
        if not existing_users:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        current_role = existing_users[0].get("role")
        
        # Prevent changing the last admin
        if current_role == "admin" and new_role != "admin":
            admin_count = len(get_data("profiles", {"role": "admin"}))
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change role of the last admin user"
                )
        
        # Update role
        updated_users = update_data("profiles", {"id": user_id}, {"role": new_role})
        
        if not updated_users:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user role"
            )
        
        logger.info(f"User {user_id} role changed from {current_role} to {new_role} by admin {current_user['profile']['id']}")
        return ProfileResponse(**updated_users[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to change role for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change user role"
        )