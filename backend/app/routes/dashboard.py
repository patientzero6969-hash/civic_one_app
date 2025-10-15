from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.supabase_client import (
    get_data, count_records, get_department_stats, get_issue_trends
)
from app.schemas import (
    DashboardResponse, IssueStats, UserStats, SystemStats,
    TrendsResponse, DepartmentStatsResponse, DepartmentStats,
    IssueResponse, AssignmentResponse, IssueUpdateResponse
)
from app.routes.auth import get_current_user, require_roles
from typing import List, Optional
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter()


def _calculate_avg_resolution_time(resolved_issues: List[dict]) -> Optional[float]:
    """Calculate average resolution time in days."""
    if not resolved_issues:
        return None
    
    total_days = 0
    count = 0
    
    for issue in resolved_issues:
        try:
            created_at = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
            updated_at = datetime.fromisoformat(issue["updated_at"].replace("Z", "+00:00"))
            resolution_days = (updated_at - created_at).days
            total_days += resolution_days
            count += 1
        except Exception:
            continue
    
    return round(total_days / count, 1) if count > 0 else None


@router.get("/", response_model=DashboardResponse)
async def get_dashboard_overview(
    current_user: dict = Depends(require_roles(["admin", "supervisor", "staff"]))
):
    """Get comprehensive dashboard overview."""
    try:
        user_role = current_user["profile"]["role"]
        user_id = current_user["profile"]["id"]
        
        # Initialize stats objects
        issue_stats = IssueStats(
            total_issues=0, pending_issues=0, in_progress_issues=0, 
            resolved_issues=0, issues_by_category={}, issues_by_department={}, 
            total_upvotes=0
        )
        
        user_stats = UserStats(
            total_users=0, citizens=0, staff=0, supervisors=0, 
            admins=0, users_by_department={}
        )
        
        system_stats = SystemStats(
            total_assignments=0, active_assignments=0, completed_assignments=0,
            total_updates=0, avg_updates_per_issue=0.0
        )
        
        # Role-based data filtering
        if user_role == "admin":
            # Admin sees all data
            issue_filters = {}
            assignment_filters = {}
            update_filters = {}
        
        elif user_role == "supervisor":
            # Supervisor sees data for their department
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
            dept_staff_ids = [s["id"] for s in dept_staff]
            
            if dept_staff_ids:
                assignments = get_data("issue_assignments", {"staff_id": dept_staff_ids})
                dept_issue_ids = list(set([a["issue_id"] for a in assignments]))
                
                issue_filters = {"id": dept_issue_ids} if dept_issue_ids else {"id": []}
                assignment_filters = {"staff_id": dept_staff_ids}
                update_filters = {"staff_id": dept_staff_ids}
            else:
                issue_filters = {"id": []}
                assignment_filters = {"staff_id": []}
                update_filters = {"staff_id": []}
        
        else:  # staff
            # Staff sees data for issues they're assigned to
            assignments = get_data("issue_assignments", {"staff_id": user_id})
            assigned_issue_ids = [a["issue_id"] for a in assignments]
            
            issue_filters = {"id": assigned_issue_ids} if assigned_issue_ids else {"id": []}
            assignment_filters = {"staff_id": user_id}
            update_filters = {"staff_id": user_id}
        
        # Calculate issue statistics
        if not (user_role != "admin" and not issue_filters.get("id")):
            issue_stats.total_issues = count_records("issues", issue_filters)
            issue_stats.pending_issues = count_records("issues", {**issue_filters, "status": "pending"})
            issue_stats.in_progress_issues = count_records("issues", {**issue_filters, "status": "in_progress"})
            issue_stats.resolved_issues = count_records("issues", {**issue_filters, "status": "resolved"})
            
            # Issues by category
            categories = ["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]
            for category in categories:
                count = count_records("issues", {**issue_filters, "category": category})
                issue_stats.issues_by_category[category] = count
            
            # Total upvotes
            all_issues = get_data("issues", filters=issue_filters, select_fields="upvotes")
            issue_stats.total_upvotes = sum(issue.get("upvotes", 0) for issue in all_issues)
            
            # Average resolution time
            resolved_issues = get_data("issues", {**issue_filters, "status": "resolved"})
            issue_stats.avg_resolution_time = _calculate_avg_resolution_time(resolved_issues)
        
        # User statistics (admin and supervisor only)
        if user_role in ["admin", "supervisor"]:
            if user_role == "admin":
                all_users = get_data("profiles")
            else:
                # Supervisor sees users in their department
                user_department = current_user["profile"]["department"]
                all_users = get_data("profiles", {"department": user_department})
            
            user_stats.total_users = len(all_users)
            
            for user in all_users:
                role = user.get("role", "citizen")
                department = user.get("department", "None")
                
                if role == "citizen":
                    user_stats.citizens += 1
                elif role == "staff":
                    user_stats.staff += 1
                elif role == "supervisor":
                    user_stats.supervisors += 1
                elif role == "admin":
                    user_stats.admins += 1
                
                user_stats.users_by_department[department] = user_stats.users_by_department.get(department, 0) + 1
        
        # System statistics
        all_assignments = get_data("issue_assignments", assignment_filters)
        system_stats.total_assignments = len(all_assignments)
        system_stats.active_assignments = len([a for a in all_assignments if a["status"] in ["assigned", "in_progress"]])
        system_stats.completed_assignments = len([a for a in all_assignments if a["status"] == "completed"])
        
        all_updates = get_data("issue_updates", update_filters)
        system_stats.total_updates = len(all_updates)
        
        if issue_stats.total_issues > 0:
            system_stats.avg_updates_per_issue = round(system_stats.total_updates / issue_stats.total_issues, 1)
        
        # Issues by department (admin only)
        if user_role == "admin":
            try:
                dept_stats = get_department_stats()
                for dept in dept_stats:
                    issue_stats.issues_by_department[dept["department"]] = dept["total_issues"]
            except Exception as e:
                logger.warning(f"Failed to get department stats: {str(e)}")
        
        # Get recent data
        recent_issues = []
        recent_assignments = []
        recent_updates = []
        
        try:
            # Recent issues
            recent_issue_data = get_data(
                "issues", 
                filters=issue_filters,
                select_fields="*, profiles!citizen_id(full_name)",
                order_by="-created_at",
                limit=5
            )
            
            for issue in recent_issue_data:
                if issue.get("profiles"):
                    issue["citizen_name"] = issue["profiles"]["full_name"]
                    del issue["profiles"]
                recent_issues.append(IssueResponse(**issue))
            
            # Recent assignments
            recent_assignment_data = get_data(
                "issue_assignments",
                filters=assignment_filters,
                select_fields="""
                *, 
                staff:profiles!staff_id(full_name),
                issues!issue_id(title, category)
                """,
                order_by="-assigned_at",
                limit=5
            )
            
            for assignment in recent_assignment_data:
                if assignment.get("staff"):
                    assignment["staff_name"] = assignment["staff"]["full_name"]
                    del assignment["staff"]
                if assignment.get("issues"):
                    assignment["issue_title"] = assignment["issues"]["title"]
                    assignment["issue_category"] = assignment["issues"]["category"]
                    del assignment["issues"]
                recent_assignments.append(AssignmentResponse(**assignment))
            
            # Recent updates
            recent_update_data = get_data(
                "issue_updates",
                filters=update_filters,
                select_fields="*, profiles!staff_id(full_name)",
                order_by="-created_at",
                limit=5
            )
            
            for update in recent_update_data:
                if update.get("profiles"):
                    update["staff_name"] = update["profiles"]["full_name"]
                    del update["profiles"]
                recent_updates.append(IssueUpdateResponse(**update))
        
        except Exception as e:
            logger.warning(f"Failed to get recent data: {str(e)}")
        
        dashboard_data = DashboardResponse(
            success=True,
            message="Dashboard data retrieved successfully",
            issue_stats=issue_stats,
            user_stats=user_stats,
            system_stats=system_stats,
            recent_issues=recent_issues,
            recent_assignments=recent_assignments,
            recent_updates=recent_updates
        )
        
        logger.info(f"Dashboard overview provided for {user_role} {user_id}")
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Failed to get dashboard overview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard data"
        )


@router.get("/trends", response_model=TrendsResponse)
async def get_trends(
    days: int = Query(30, ge=1, le=365, description="Number of days for trend analysis"),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Get trend data for charts and analytics."""
    try:
        user_role = current_user["profile"]["role"]
        
        # Get trend data
        trend_data = get_issue_trends(days)
        
        # Filter data for supervisors (simplified implementation)
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            # In a real implementation, you'd filter the trend data by department
            # For now, we'll return the same data but note it's for supervisor
            logger.info(f"Trends requested by supervisor of {user_department} department")
        
        return TrendsResponse(
            success=True,
            message="Trend data retrieved successfully",
            issues_created=trend_data["issues_created"],
            issues_resolved=trend_data["issues_resolved"],
            issues_by_category=[]  # Would need more complex aggregation
        )
        
    except Exception as e:
        logger.error(f"Failed to get trends: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch trend data"
        )


@router.get("/departments", response_model=DepartmentStatsResponse)
async def get_department_statistics(
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Get statistics by department."""
    try:
        user_role = current_user["profile"]["role"]
        
        if user_role == "supervisor":
            # Supervisors only see their department stats
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
            
            # Calculate department stats
            dept_stats = []
            if user_department:
                staff_ids = [s["id"] for s in dept_staff]
                assignments = get_data("issue_assignments", {"staff_id": staff_ids}) if staff_ids else []
                issue_ids = list(set([a["issue_id"] for a in assignments]))
                
                total_issues = len(issue_ids)
                pending_issues = count_records("issues", {"id": issue_ids, "status": "pending"}) if issue_ids else 0
                in_progress_issues = count_records("issues", {"id": issue_ids, "status": "in_progress"}) if issue_ids else 0
                resolved_issues = count_records("issues", {"id": issue_ids, "status": "resolved"}) if issue_ids else 0
                
                # Calculate average resolution time
                resolved_issue_data = get_data("issues", {"id": issue_ids, "status": "resolved"}) if issue_ids else []
                avg_resolution_time = _calculate_avg_resolution_time(resolved_issue_data)
                
                dept_stats.append(DepartmentStats(
                    department=user_department,
                    total_issues=total_issues,
                    pending_issues=pending_issues,
                    in_progress_issues=in_progress_issues,
                    resolved_issues=resolved_issues,
                    total_staff=len(dept_staff),
                    avg_resolution_time=avg_resolution_time
                ))
        
        else:  # admin
            # Get all department stats
            dept_data = get_department_stats()
            dept_stats = [DepartmentStats(**dept) for dept in dept_data]
        
        return DepartmentStatsResponse(
            success=True,
            message="Department statistics retrieved successfully",
            departments=dept_stats
        )
        
    except Exception as e:
        logger.error(f"Failed to get department statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch department statistics"
        )


@router.get("/performance")
async def get_performance_metrics(
    period: str = Query("month", description="Time period: week, month, quarter, year"),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Get performance metrics for the specified period."""
    try:
        user_role = current_user["profile"]["role"]
        
        # Calculate date range
        end_date = datetime.now()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        elif period == "quarter":
            start_date = end_date - timedelta(days=90)
        elif period == "year":
            start_date = end_date - timedelta(days=365)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid period. Use: week, month, quarter, or year"
            )
        
        filters = {
            "created_at": {"operator": "gte", "value": start_date.isoformat()}
        }
        
        # Role-based filtering
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
            dept_staff_ids = [s["id"] for s in dept_staff]
            
            if dept_staff_ids:
                assignments = get_data("issue_assignments", {"staff_id": dept_staff_ids})
                dept_issue_ids = [a["issue_id"] for a in assignments]
                if dept_issue_ids:
                    filters["id"] = dept_issue_ids
                else:
                    # No issues in department
                    return {
                        "period": period,
                        "department": user_department,
                        "metrics": {
                            "issues_created": 0,
                            "issues_resolved": 0,
                            "resolution_rate": 0.0,
                            "avg_resolution_time": None,
                            "staff_productivity": [],
                            "category_breakdown": {}
                        }
                    }
            else:
                return {
                    "period": period,
                    "department": user_department,
                    "metrics": {
                        "issues_created": 0,
                        "issues_resolved": 0,
                        "resolution_rate": 0.0,
                        "avg_resolution_time": None,
                        "staff_productivity": [],
                        "category_breakdown": {}
                    }
                }
        
        # Get issues in the period
        period_issues = get_data("issues", filters)
        issues_created = len(period_issues)
        
        # Get resolved issues
        resolved_filters = {**filters, "status": "resolved"}
        resolved_issues = get_data("issues", resolved_filters)
        issues_resolved = len(resolved_issues)
        
        # Calculate resolution rate
        resolution_rate = round((issues_resolved / issues_created * 100), 1) if issues_created > 0 else 0.0
        
        # Calculate average resolution time
        avg_resolution_time = _calculate_avg_resolution_time(resolved_issues)
        
        # Category breakdown
        categories = ["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]
        category_breakdown = {}
        for category in categories:
            count = len([i for i in period_issues if i.get("category") == category])
            category_breakdown[category] = count
        
        # Staff productivity (for supervisors and admins)
        staff_productivity = []
        if user_role == "supervisor":
            user_department = current_user["profile"]["department"]
            dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
        else:
            dept_staff = get_data("profiles", {"role": "staff"})
        
        for staff in dept_staff[:10]:  # Limit to top 10 for performance
            staff_assignments = get_data("issue_assignments", {
                "staff_id": staff["id"],
                "assigned_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            
            staff_updates = get_data("issue_updates", {
                "staff_id": staff["id"],
                "created_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            
            completed_assignments = len([a for a in staff_assignments if a["status"] == "completed"])
            
            staff_productivity.append({
                "staff_id": staff["id"],
                "name": staff.get("full_name", "Unknown"),
                "department": staff.get("department", "Unknown"),
                "assignments_received": len(staff_assignments),
                "assignments_completed": completed_assignments,
                "updates_created": len(staff_updates),
                "completion_rate": round((completed_assignments / len(staff_assignments) * 100), 1) if staff_assignments else 0.0
            })
        
        # Sort by completion rate
        staff_productivity.sort(key=lambda x: x["completion_rate"], reverse=True)
        
        metrics = {
            "period": period,
            "department": current_user["profile"]["department"] if user_role == "supervisor" else "All Departments",
            "metrics": {
                "issues_created": issues_created,
                "issues_resolved": issues_resolved,
                "resolution_rate": resolution_rate,
                "avg_resolution_time": avg_resolution_time,
                "staff_productivity": staff_productivity,
                "category_breakdown": category_breakdown
            }
        }
        
        return metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch performance metrics"
        )


@router.get("/export")
async def export_dashboard_data(
    format: str = Query("json", description="Export format: json, csv"),
    include_personal_data: bool = Query(False, description="Include personal information"),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Export dashboard data in various formats."""
    try:
        user_role = current_user["profile"]["role"]
        
        if format not in ["json", "csv"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid format. Use 'json' or 'csv'"
            )
        
        # Get dashboard data (reuse the main dashboard endpoint logic)
        dashboard_data = await get_dashboard_overview(current_user)
        
        if format == "json":
            # Return JSON data
            export_data = {
                "exported_at": datetime.now().isoformat(),
                "exported_by": current_user["profile"]["full_name"],
                "user_role": user_role,
                "dashboard_data": dashboard_data.dict()
            }
            
            if not include_personal_data:
                # Remove personal information
                for issue in export_data["dashboard_data"]["recent_issues"]:
                    issue.pop("citizen_name", None)
                    issue.pop("citizen_phone", None)
                
                for assignment in export_data["dashboard_data"]["recent_assignments"]:
                    assignment.pop("staff_name", None)
                
                for update in export_data["dashboard_data"]["recent_updates"]:
                    update.pop("staff_name", None)
            
            return export_data
        
        else:  # CSV format
            # For CSV, we'll return a simplified version
            # In a real application, you'd want to use pandas or csv module
            return {
                "message": "CSV export would be implemented here",
                "data": {
                    "total_issues": dashboard_data.issue_stats.total_issues,
                    "pending_issues": dashboard_data.issue_stats.pending_issues,
                    "resolved_issues": dashboard_data.issue_stats.resolved_issues,
                    "total_assignments": dashboard_data.system_stats.total_assignments
                }
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export dashboard data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export dashboard data"
        )