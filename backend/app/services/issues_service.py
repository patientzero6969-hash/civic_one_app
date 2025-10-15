from app.supabase_client import (
    insert_data, get_data, update_data, delete_data, count_records,
    get_paginated_data, search_data, get_user_vote_status
)
from typing import Dict, List, Optional, Any, Tuple
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class IssuesService:
    """Service class for issue-related business logic."""
    
    @staticmethod
    def create_issue(data: Dict[str, Any], user_id: str, user_role: str) -> Dict[str, Any]:
        """Create a new issue with proper validation and processing."""
        try:
            # Set citizen_id based on role
            if user_role == "citizen":
                data["citizen_id"] = user_id
            elif not data.get("citizen_id"):
                data["citizen_id"] = user_id
            
            # Validate required fields
            required_fields = ["title", "description", "category", "citizen_id"]
            for field in required_fields:
                if not data.get(field):
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate category
            valid_categories = ["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]
            if data["category"] not in valid_categories:
                raise ValueError(f"Invalid category. Must be one of: {valid_categories}")
            
            # Validate coordinates if provided
            if data.get("latitude") is not None:
                if not (-90 <= data["latitude"] <= 90):
                    raise ValueError("Invalid latitude. Must be between -90 and 90")
            
            if data.get("longitude") is not None:
                if not (-180 <= data["longitude"] <= 180):
                    raise ValueError("Invalid longitude. Must be between -180 and 180")
            
            # Create the issue
            result = insert_data("issues", data)
            
            if not result:
                raise Exception("Failed to create issue in database")
            
            logger.info(f"Issue created successfully: {result[0]['id']}")
            return result[0]
            
        except Exception as e:
            logger.error(f"Failed to create issue: {str(e)}")
            raise
    
    @staticmethod
    def get_all_issues(filters: Optional[Dict[str, Any]] = None,
                      page: int = 1, per_page: int = 20,
                      order_by: str = "-created_at") -> Tuple[List[Dict[str, Any]], int]:
        """Get all issues with optional filtering and pagination."""
        try:
            return get_paginated_data(
                table="issues",
                page=page,
                per_page=per_page,
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by=order_by
            )
        except Exception as e:
            logger.error(f"Failed to get issues: {str(e)}")
            raise
    
    @staticmethod
    def get_issue_by_id(issue_id: int, include_citizen_info: bool = True) -> Optional[Dict[str, Any]]:
        """Get issue by ID with optional citizen information."""
        try:
            select_fields = "*, profiles!citizen_id(full_name, phone)" if include_citizen_info else "*"
            issues = get_data("issues", {"id": issue_id}, select_fields=select_fields)
            return issues[0] if issues else None
        except Exception as e:
            logger.error(f"Failed to get issue {issue_id}: {str(e)}")
            raise
    
    @staticmethod
    def update_issue(issue_id: int, new_data: Dict[str, Any], 
                    user_id: str, user_role: str) -> Dict[str, Any]:
        """Update an issue with permission checks."""
        try:
            # Get existing issue
            existing_issue = IssuesService.get_issue_by_id(issue_id, include_citizen_info=False)
            if not existing_issue:
                raise ValueError("Issue not found")
            
            # Permission checks
            if user_role == "citizen":
                if existing_issue["citizen_id"] != user_id:
                    raise PermissionError("Not authorized to update this issue")
                # Citizens cannot change status
                new_data.pop("status", None)
            
            # Validate data if provided
            if "category" in new_data:
                valid_categories = ["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]
                if new_data["category"] not in valid_categories:
                    raise ValueError(f"Invalid category. Must be one of: {valid_categories}")
            
            if "latitude" in new_data and new_data["latitude"] is not None:
                if not (-90 <= new_data["latitude"] <= 90):
                    raise ValueError("Invalid latitude")
            
            if "longitude" in new_data and new_data["longitude"] is not None:
                if not (-180 <= new_data["longitude"] <= 180):
                    raise ValueError("Invalid longitude")
            
            # Add updated timestamp
            new_data["updated_at"] = datetime.now().isoformat()
            
            # Update issue
            result = update_data("issues", {"id": issue_id}, new_data)
            
            if not result:
                raise Exception("Failed to update issue in database")
            
            logger.info(f"Issue {issue_id} updated by user {user_id}")
            return result[0]
            
        except Exception as e:
            logger.error(f"Failed to update issue {issue_id}: {str(e)}")
            raise
    
    @staticmethod
    def delete_issue(issue_id: int, user_id: str) -> bool:
        """Delete an issue and all related data (admin only)."""
        try:
            # Check if issue exists
            existing_issue = IssuesService.get_issue_by_id(issue_id, include_citizen_info=False)
            if not existing_issue:
                raise ValueError("Issue not found")
            
            # Delete related records first
            delete_data("issue_votes", {"issue_id": issue_id})
            delete_data("issue_updates", {"issue_id": issue_id})
            delete_data("issue_assignments", {"issue_id": issue_id})
            
            # Delete the issue
            delete_data("issues", {"id": issue_id})
            
            logger.info(f"Issue {issue_id} deleted by admin {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete issue {issue_id}: {str(e)}")
            raise
    
    @staticmethod
    def vote_on_issue(issue_id: int, user_id: str) -> Dict[str, Any]:
        """Vote on an issue (upvote)."""
        try:
            # Check if issue exists
            issue = IssuesService.get_issue_by_id(issue_id, include_citizen_info=False)
            if not issue:
                raise ValueError("Issue not found")
            
            # Check if user already voted
            existing_votes = get_data("issue_votes", {"issue_id": issue_id, "user_id": user_id})
            if existing_votes:
                raise ValueError("User has already voted on this issue")
            
            # Create vote
            vote_data = {
                "issue_id": issue_id,
                "user_id": user_id
            }
            
            result = insert_data("issue_votes", vote_data)
            
            if not result:
                raise Exception("Failed to record vote")
            
            # The upvote count is automatically updated by database trigger
            logger.info(f"User {user_id} voted on issue {issue_id}")
            return result[0]
            
        except Exception as e:
            logger.error(f"Failed to vote on issue {issue_id}: {str(e)}")
            raise
    
    @staticmethod
    def remove_vote(issue_id: int, user_id: str) -> bool:
        """Remove a vote from an issue."""
        try:
            # Check if vote exists
            existing_votes = get_data("issue_votes", {"issue_id": issue_id, "user_id": user_id})
            if not existing_votes:
                raise ValueError("Vote not found")
            
            # Delete vote
            delete_data("issue_votes", {"issue_id": issue_id, "user_id": user_id})
            
            # The upvote count is automatically updated by database trigger
            logger.info(f"User {user_id} removed vote from issue {issue_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove vote from issue {issue_id}: {str(e)}")
            raise
    
    @staticmethod
    def search_issues(query: str, filters: Optional[Dict[str, Any]] = None,
                     page: int = 1, per_page: int = 20) -> Tuple[List[Dict[str, Any]], int]:
        """Search issues by title and description."""
        try:
            if not query.strip():
                return IssuesService.get_all_issues(filters, page, per_page)
            
            search_fields = ["title", "description"]
            results = search_data(
                table="issues",
                search_fields=search_fields,
                search_term=query,
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by="-created_at"
            )
            
            # Manual pagination for search results
            total = len(results)
            start = (page - 1) * per_page
            end = start + per_page
            paginated_results = results[start:end]
            
            return paginated_results, total
            
        except Exception as e:
            logger.error(f"Failed to search issues: {str(e)}")
            raise
    
    @staticmethod
    def get_issues_by_citizen(citizen_id: str, filters: Optional[Dict[str, Any]] = None,
                             page: int = 1, per_page: int = 20) -> Tuple[List[Dict[str, Any]], int]:
        """Get issues by citizen ID."""
        try:
            if filters is None:
                filters = {}
            filters["citizen_id"] = citizen_id
            
            return IssuesService.get_all_issues(filters, page, per_page)
            
        except Exception as e:
            logger.error(f"Failed to get issues for citizen {citizen_id}: {str(e)}")
            raise
    
    @staticmethod
    def get_nearby_issues(latitude: float, longitude: float, radius: float = 5.0,
                         filters: Optional[Dict[str, Any]] = None,
                         limit: int = 20) -> List[Dict[str, Any]]:
        """Get issues near a specific location."""
        try:
            # Add location filters
            location_filters = {
                "latitude": {"operator": "neq", "value": None},
                "longitude": {"operator": "neq", "value": None}
            }
            
            if filters:
                location_filters.update(filters)
            
            # Get all issues with location
            issues = get_data(
                "issues",
                filters=location_filters,
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
            return nearby_issues[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get nearby issues: {str(e)}")
            raise
    
    @staticmethod
    def get_issue_statistics(user_role: str, user_id: str, 
                           user_department: Optional[str] = None) -> Dict[str, Any]:
        """Get issue statistics based on user role."""
        try:
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
            filters = {}
            
            if user_role == "citizen":
                filters["citizen_id"] = user_id
            elif user_role == "staff":
                # Get issues assigned to the staff member
                assignments = get_data("issue_assignments", {"staff_id": user_id})
                assigned_issue_ids = [a["issue_id"] for a in assignments]
                if assigned_issue_ids:
                    filters["id"] = assigned_issue_ids
                else:
                    return stats  # No assigned issues
            elif user_role == "supervisor":
                # Get issues assigned to staff in supervisor's department
                if user_department:
                    dept_staff = get_data("profiles", {"department": user_department, "role": "staff"})
                    staff_ids = [s["id"] for s in dept_staff]
                    
                    if staff_ids:
                        assignments = get_data("issue_assignments", {"staff_id": staff_ids})
                        dept_issue_ids = list(set([a["issue_id"] for a in assignments]))
                        
                        if dept_issue_ids:
                            filters["id"] = dept_issue_ids
                        else:
                            return stats  # No issues in department
                    else:
                        return stats  # No staff in department
                else:
                    return stats  # No department specified
            # Admin has no filters (sees all issues)
            
            # Calculate basic counts
            stats["total_issues"] = count_records("issues", filters)
            stats["pending_issues"] = count_records("issues", {**filters, "status": "pending"})
            stats["in_progress_issues"] = count_records("issues", {**filters, "status": "in_progress"})
            stats["resolved_issues"] = count_records("issues", {**filters, "status": "resolved"})
            
            # Issues by category
            categories = ["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]
            for category in categories:
                count = count_records("issues", {**filters, "category": category})
                stats["issues_by_category"][category] = count
            
            # Total upvotes
            all_issues = get_data("issues", filters=filters, select_fields="upvotes")
            stats["total_upvotes"] = sum(issue.get("upvotes", 0) for issue in all_issues)
            
            # Average resolution time for resolved issues
            resolved_issues = get_data("issues", {**filters, "status": "resolved"})
            if resolved_issues:
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
                
                if count > 0:
                    stats["avg_resolution_time"] = round(total_days / count, 1)
            
            # Issues by department (admin only)
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
            logger.error(f"Failed to get issue statistics: {str(e)}")
            raise
    
    @staticmethod
    def get_trending_issues(days: int = 7, limit: int = 10) -> List[Dict[str, Any]]:
        """Get trending issues based on recent votes and activity."""
        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Get recent votes
            recent_votes = get_data("issue_votes", {
                "created_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            
            # Count votes per issue
            vote_counts = {}
            for vote in recent_votes:
                issue_id = vote["issue_id"]
                vote_counts[issue_id] = vote_counts.get(issue_id, 0) + 1
            
            # Get recent updates
            recent_updates = get_data("issue_updates", {
                "created_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            
            # Count updates per issue
            update_counts = {}
            for update in recent_updates:
                issue_id = update["issue_id"]
                update_counts[issue_id] = update_counts.get(issue_id, 0) + 1
            
            # Calculate trending score (votes + updates)
            trending_scores = {}
            all_issue_ids = set(list(vote_counts.keys()) + list(update_counts.keys()))
            
            for issue_id in all_issue_ids:
                score = vote_counts.get(issue_id, 0) * 2 + update_counts.get(issue_id, 0)  # Votes weighted more
                trending_scores[issue_id] = score
            
            # Get top trending issues
            top_issue_ids = sorted(trending_scores.keys(), 
                                 key=lambda x: trending_scores[x], 
                                 reverse=True)[:limit]
            
            if not top_issue_ids:
                return []
            
            # Get issue details
            trending_issues = get_data(
                "issues",
                {"id": top_issue_ids},
                select_fields="*, profiles!citizen_id(full_name)"
            )
            
            # Add trending score to each issue
            for issue in trending_issues:
                issue["trending_score"] = trending_scores[issue["id"]]
                issue["recent_votes"] = vote_counts.get(issue["id"], 0)
                issue["recent_updates"] = update_counts.get(issue["id"], 0)
            
            # Sort by trending score
            trending_issues.sort(key=lambda x: x["trending_score"], reverse=True)
            
            return trending_issues
            
        except Exception as e:
            logger.error(f"Failed to get trending issues: {str(e)}")
            raise
    
    @staticmethod
    def get_user_issue_activity(user_id: str, days: int = 30) -> Dict[str, Any]:
        """Get user's issue-related activity."""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            activity = {
                "period_days": days,
                "issues_created": 0,
                "votes_cast": 0,
                "updates_received": 0,
                "issues_resolved": 0,
                "recent_activity": []
            }
            
            # Issues created by user
            user_issues = get_data("issues", {
                "citizen_id": user_id,
                "created_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            activity["issues_created"] = len(user_issues)
            
            # Votes cast by user
            user_votes = get_data("issue_votes", {
                "user_id": user_id,
                "created_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            activity["votes_cast"] = len(user_votes)
            
            # Updates received on user's issues
            if user_issues:
                user_issue_ids = [i["id"] for i in user_issues]
                updates_on_user_issues = get_data("issue_updates", {
                    "issue_id": user_issue_ids,
                    "created_at": {"operator": "gte", "value": start_date.isoformat()}
                })
                activity["updates_received"] = len(updates_on_user_issues)
            
            # Issues resolved
            resolved_issues = get_data("issues", {
                "citizen_id": user_id,
                "status": "resolved",
                "updated_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            activity["issues_resolved"] = len(resolved_issues)
            
            # Recent activity timeline
            recent_activity = []
            
            # Add created issues
            for issue in user_issues[-5:]:  # Last 5
                recent_activity.append({
                    "type": "issue_created",
                    "timestamp": issue["created_at"],
                    "description": f"Created issue: {issue['title']}",
                    "issue_id": issue["id"]
                })
            
            # Add votes
            for vote in user_votes[-5:]:  # Last 5
                recent_activity.append({
                    "type": "vote_cast",
                    "timestamp": vote["created_at"],
                    "description": f"Voted on issue #{vote['issue_id']}",
                    "issue_id": vote["issue_id"]
                })
            
            # Sort by timestamp
            recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)
            activity["recent_activity"] = recent_activity[:10]  # Top 10
            
            return activity
            
        except Exception as e:
            logger.error(f"Failed to get user activity for {user_id}: {str(e)}")
            raise
    
    @staticmethod
    def bulk_update_status(issue_ids: List[int], new_status: str, user_id: str, 
                          user_role: str) -> Dict[str, Any]:
        """Bulk update status of multiple issues."""
        try:
            if user_role not in ["admin", "supervisor"]:
                raise PermissionError("Not authorized for bulk operations")
            
            valid_statuses = ["pending", "in_progress", "resolved"]
            if new_status not in valid_statuses:
                raise ValueError(f"Invalid status. Must be one of: {valid_statuses}")
            
            results = {
                "processed": 0,
                "failed": 0,
                "errors": []
            }
            
            for issue_id in issue_ids:
                try:
                    # Check if issue exists
                    existing_issue = IssuesService.get_issue_by_id(issue_id, include_citizen_info=False)
                    if not existing_issue:
                        results["errors"].append(f"Issue {issue_id} not found")
                        results["failed"] += 1
                        continue
                    
                    # Update status
                    update_data_dict = {
                        "status": new_status,
                        "updated_at": datetime.now().isoformat()
                    }
                    
                    updated = update_data("issues", {"id": issue_id}, update_data_dict)
                    if updated:
                        results["processed"] += 1
                    else:
                        results["errors"].append(f"Failed to update issue {issue_id}")
                        results["failed"] += 1
                        
                except Exception as e:
                    results["errors"].append(f"Issue {issue_id}: {str(e)}")
                    results["failed"] += 1
            
            logger.info(f"Bulk status update: {results['processed']} processed, {results['failed']} failed by {user_id}")
            return results
            
        except Exception as e:
            logger.error(f"Failed bulk status update: {str(e)}")
            raise
    
    @staticmethod
    def get_priority_issues(days: int = 7, min_upvotes: int = 10) -> List[Dict[str, Any]]:
        """Get high priority issues based on upvotes and age."""
        try:
            # Calculate date range for recent issues
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Get issues with high upvotes or old pending issues
            filters = {
                "upvotes": {"operator": "gte", "value": min_upvotes}
            }
            
            high_upvote_issues = get_data(
                "issues",
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by="-upvotes"
            )
            
            # Get old pending issues (more than 7 days old)
            old_pending_filters = {
                "status": "pending",
                "created_at": {"operator": "lte", "value": start_date.isoformat()}
            }
            
            old_pending_issues = get_data(
                "issues",
                filters=old_pending_filters,
                select_fields="*, profiles!citizen_id(full_name, phone)",
                order_by="created_at"  # Oldest first
            )
            
            # Combine and deduplicate
            priority_issues = []
            seen_ids = set()
            
            # Add high upvote issues first
            for issue in high_upvote_issues:
                if issue["id"] not in seen_ids:
                    issue["priority_reason"] = f"High upvotes ({issue.get('upvotes', 0)})"
                    priority_issues.append(issue)
                    seen_ids.add(issue["id"])
            
            # Add old pending issues
            for issue in old_pending_issues:
                if issue["id"] not in seen_ids:
                    created_date = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
                    days_old = (datetime.now().replace(tzinfo=created_date.tzinfo) - created_date).days
                    issue["priority_reason"] = f"Pending for {days_old} days"
                    priority_issues.append(issue)
                    seen_ids.add(issue["id"])
            
            # Sort by priority score (upvotes + age factor)
            for issue in priority_issues:
                upvotes = issue.get("upvotes", 0)
                created_date = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
                days_old = (datetime.now().replace(tzinfo=created_date.tzinfo) - created_date).days
                
                # Priority score: upvotes + (days_old * 0.5)
                issue["priority_score"] = upvotes + (days_old * 0.5)
            
            priority_issues.sort(key=lambda x: x.get("priority_score", 0), reverse=True)
            
            return priority_issues[:20]  # Return top 20 priority issues
            
        except Exception as e:
            logger.error(f"Failed to get priority issues: {str(e)}")
            raise
    
    @staticmethod
    def get_category_insights(category: str, days: int = 30) -> Dict[str, Any]:
        """Get insights for a specific category of issues."""
        try:
            valid_categories = ["potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"]
            if category not in valid_categories:
                raise ValueError(f"Invalid category. Must be one of: {valid_categories}")
            
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Get category issues
            category_issues = get_data("issues", {"category": category})
            recent_issues = get_data("issues", {
                "category": category,
                "created_at": {"operator": "gte", "value": start_date.isoformat()}
            })
            
            # Basic statistics
            total_issues = len(category_issues)
            recent_count = len(recent_issues)
            pending_count = len([i for i in category_issues if i["status"] == "pending"])
            resolved_count = len([i for i in category_issues if i["status"] == "resolved"])
            
            # Calculate average resolution time
            resolved_issues = [i for i in category_issues if i["status"] == "resolved"]
            avg_resolution_days = None
            
            if resolved_issues:
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
                
                if count > 0:
                    avg_resolution_days = round(total_days / count, 1)
            
            # Top locations (if available)
            locations = {}
            for issue in category_issues:
                if issue.get("latitude") and issue.get("longitude"):
                    # Simple location clustering (you might want more sophisticated clustering)
                    lat_rounded = round(issue["latitude"], 2)
                    lng_rounded = round(issue["longitude"], 2)
                    location_key = f"{lat_rounded},{lng_rounded}"
                    
                    if location_key not in locations:
                        locations[location_key] = {
                            "lat": lat_rounded,
                            "lng": lng_rounded,
                            "count": 0
                        }
                    locations[location_key]["count"] += 1
            
            top_locations = sorted(
                locations.values(),
                key=lambda x: x["count"],
                reverse=True
            )[:5]
            
            # Trend analysis (simplified)
            trend = "stable"
            if len(category_issues) > 0:
                recent_percentage = (recent_count / total_issues) * 100
                if recent_percentage > 50:
                    trend = "increasing"
                elif recent_percentage < 20:
                    trend = "decreasing"
            
            insights = {
                "category": category,
                "period_days": days,
                "total_issues": total_issues,
                "recent_issues": recent_count,
                "pending_issues": pending_count,
                "resolved_issues": resolved_count,
                "resolution_rate": round((resolved_count / total_issues) * 100, 1) if total_issues > 0 else 0,
                "avg_resolution_days": avg_resolution_days,
                "trend": trend,
                "top_locations": top_locations,
                "total_upvotes": sum(issue.get("upvotes", 0) for issue in category_issues),
                "avg_upvotes": round(sum(issue.get("upvotes", 0) for issue in category_issues) / total_issues, 1) if total_issues > 0 else 0
            }
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to get category insights for {category}: {str(e)}")
            raise
    
    @staticmethod
    def generate_issue_report(filters: Optional[Dict[str, Any]] = None, 
                            format: str = "summary") -> Dict[str, Any]:
        """Generate comprehensive issue report."""
        try:
            # Get issues based on filters
            issues = get_data(
                "issues",
                filters=filters,
                select_fields="*, profiles!citizen_id(full_name, phone)"
            )
            
            if not issues:
                return {
                    "report_type": format,
                    "total_issues": 0,
                    "message": "No issues found matching the criteria"
                }
            
            # Basic statistics
            total_issues = len(issues)
            status_counts = {"pending": 0, "in_progress": 0, "resolved": 0}
            category_counts = {"potholes": 0, "DamagedElectricalPoles": 0, "Garbage": 0, "WaterLogging": 0, "FallenTrees": 0}
            
            total_upvotes = 0
            issues_with_location = 0
            
            for issue in issues:
                # Count by status
                status = issue.get("status", "pending")
                status_counts[status] = status_counts.get(status, 0) + 1
                
                # Count by category
                category = issue.get("category", "other")
                category_counts[category] = category_counts.get(category, 0) + 1
                
                # Count upvotes
                total_upvotes += issue.get("upvotes", 0)
                
                # Count issues with location
                if issue.get("latitude") and issue.get("longitude"):
                    issues_with_location += 1
            
            # Calculate resolution rate
            resolution_rate = round((status_counts["resolved"] / total_issues) * 100, 1) if total_issues > 0 else 0
            
            # Average upvotes
            avg_upvotes = round(total_upvotes / total_issues, 1) if total_issues > 0 else 0
            
            # Location coverage
            location_coverage = round((issues_with_location / total_issues) * 100, 1) if total_issues > 0 else 0
            
            report = {
                "report_type": format,
                "generated_at": datetime.now().isoformat(),
                "total_issues": total_issues,
                "summary": {
                    "status_breakdown": status_counts,
                    "category_breakdown": category_counts,
                    "resolution_rate": resolution_rate,
                    "total_upvotes": total_upvotes,
                    "avg_upvotes": avg_upvotes,
                    "location_coverage": location_coverage
                }
            }
            
            if format == "detailed":
                # Add detailed analysis
                report["detailed_analysis"] = {
                    "top_categories": sorted(
                        category_counts.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:3],
                    "issues_needing_attention": [
                        issue for issue in issues
                        if issue["status"] == "pending" and issue.get("upvotes", 0) >= 5
                    ][:10],
                    "recent_issues": sorted(
                        issues,
                        key=lambda x: x["created_at"],
                        reverse=True
                    )[:5]
                }
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate issue report: {str(e)}")
            raise
    
    @staticmethod
    def check_duplicate_issues(title: str, description: str, 
                             citizen_id: str, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Check for potential duplicate issues using simple text similarity."""
        try:
            # Get recent issues from the same citizen
            recent_issues = get_data("issues", {
                "citizen_id": citizen_id,
                "created_at": {"operator": "gte", "value": (datetime.now() - timedelta(days=30)).isoformat()}
            })
            
            potential_duplicates = []
            
            # Simple similarity check (you might want to use more sophisticated methods)
            title_words = set(title.lower().split())
            desc_words = set(description.lower().split())
            
            for issue in recent_issues:
                issue_title_words = set(issue["title"].lower().split())
                issue_desc_words = set(issue["description"].lower().split())
                
                # Calculate Jaccard similarity for title and description
                title_similarity = len(title_words.intersection(issue_title_words)) / len(title_words.union(issue_title_words))
                desc_similarity = len(desc_words.intersection(issue_desc_words)) / len(desc_words.union(issue_desc_words))
                
                # Combined similarity score
                combined_similarity = (title_similarity * 0.6) + (desc_similarity * 0.4)
                
                if combined_similarity >= threshold:
                    issue["similarity_score"] = round(combined_similarity, 2)
                    potential_duplicates.append(issue)
            
            # Sort by similarity score
            potential_duplicates.sort(key=lambda x: x["similarity_score"], reverse=True)
            
            return potential_duplicates[:5]  # Return top 5 potential duplicates
            
        except Exception as e:
            logger.error(f"Failed to check for duplicate issues: {str(e)}")
            return []
    
    @staticmethod
    def archive_old_issues(days_threshold: int = 365, 
                         user_id: str = None) -> Dict[str, Any]:
        """Archive old resolved issues (admin only)."""
        try:
            # Calculate cutoff date
            cutoff_date = datetime.now() - timedelta(days=days_threshold)
            
            # Find old resolved issues
            old_issues = get_data("issues", {
                "status": "resolved",
                "updated_at": {"operator": "lte", "value": cutoff_date.isoformat()}
            })
            
            if not old_issues:
                return {
                    "archived_count": 0,
                    "message": "No issues found for archiving"
                }
            
            archived_count = 0
            errors = []
            
            for issue in old_issues:
                try:
                    # In a real implementation, you might move to an archive table
                    # For now, we'll just add an archived flag
                    update_data("issues", {"id": issue["id"]}, {
                        "archived": True,
                        "archived_at": datetime.now().isoformat(),
                        "archived_by": user_id
                    })
                    archived_count += 1
                    
                except Exception as e:
                    errors.append(f"Failed to archive issue {issue['id']}: {str(e)}")
            
            result = {
                "archived_count": archived_count,
                "total_candidates": len(old_issues),
                "cutoff_date": cutoff_date.isoformat()
            }
            
            if errors:
                result["errors"] = errors
            
            logger.info(f"Archived {archived_count} issues older than {days_threshold} days")
            return result
            
        except Exception as e:
            logger.error(f"Failed to archive old issues: {str(e)}")
            raise