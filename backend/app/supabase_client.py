from supabase import create_client, Client
import os
from typing import Dict, List, Optional, Any, Union, Tuple
import logging
from datetime import datetime
import io

# Configure logging
logger = logging.getLogger(__name__)

# Supabase configuration
supabase_url = 'https://kfwxtamjqwduzudhkrxb.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmd3h0YW1qcXdkdXp1ZGhrcnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzA4MjU2OSwiZXhwIjoyMDcyNjU4NTY5fQ.MJ3K_s3Y8RVrZuQtOPT501NUxLu9m-x80r0w3RoQUNc'

# Create Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

# Add this to your supabase_client.py file, right after the existing client creation

# Create a separate storage client with explicit service role permissions
def upload_file_from_bytes_with_service_role(bucket: str, file_name: str, file_bytes: bytes,
                                           content_type: Optional[str] = None) -> str:
    """Upload file using explicit service role permissions to bypass RLS."""
    try:
        import requests
        
        # Create headers with proper content type
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': content_type or 'image/jpeg'
        }
        
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{file_name}"
        
        # Send raw bytes directly with proper headers
        response = requests.post(
            upload_url,
            headers=headers,
            data=file_bytes  # Send raw bytes directly
        )
        
        if response.status_code not in [200, 201]:
            logger.error(f"Direct upload failed: {response.status_code} - {response.text}")
            raise Exception(f"Upload failed: {response.status_code} - {response.text}")
        
        # Get public URL
        public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{file_name}"
        logger.info(f"File uploaded successfully via direct API: {file_name}")
        return public_url
        
    except Exception as e:
        logger.error(f"Service role upload failed: {str(e)}")
        raise Exception(f"Service role upload failed: {str(e)}")
    
# Basic CRUD Operations
def insert_data(table: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Insert a row into a Supabase table."""
    try:
        response = supabase.table(table).insert(data).execute()
        logger.info(f"Inserted data into {table}: {len(response.data)} rows")
        return response.data
    except Exception as e:
        logger.error(f"Insert failed for table {table}: {str(e)}")
        raise Exception(f"Insert failed for table {table}: {str(e)}")


def get_data(table: str, filters: Optional[Dict[str, Any]] = None,
            select_fields: str = "*", order_by: Optional[str] = None,
            limit: Optional[int] = None, offset: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch data from a Supabase table with optional filters and pagination."""
    try:
        query = supabase.table(table).select(select_fields)
        
        if filters:
            for col, val in filters.items():
                if isinstance(val, list):
                    query = query.in_(col, val)
                elif isinstance(val, dict) and 'operator' in val:
                    # Handle complex operators like gte, lte, ilike, etc.
                    op = val['operator']
                    value = val['value']
                    if op == 'gte':
                        query = query.gte(col, value)
                    elif op == 'lte':
                        query = query.lte(col, value)
                    elif op == 'gt':
                        query = query.gt(col, value)
                    elif op == 'lt':
                        query = query.lt(col, value)
                    elif op == 'ilike':
                        query = query.ilike(col, value)
                    elif op == 'like':
                        query = query.like(col, value)
                    elif op == 'neq':
                        query = query.neq(col, value)
                    else:
                        query = query.eq(col, value)
                else:
                    query = query.eq(col, val)
        
        if order_by:
            desc = order_by.startswith('-')
            field = order_by.lstrip('-')
            query = query.order(field, desc=desc)
        
        if limit:
            query = query.limit(limit)
        
        if offset:
            query = query.range(offset, offset + (limit or 1000) - 1)
        
        response = query.execute()
        logger.info(f"Fetched {len(response.data)} rows from {table}")
        return response.data
    except Exception as e:
        logger.error(f"Fetch failed for table {table}: {str(e)}")
        raise Exception(f"Fetch failed for table {table}: {str(e)}")


def update_data(table: str, match: Dict[str, Any], new_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Update data in a Supabase table."""
    try:
        query = supabase.table(table).update(new_data)
        for col, val in match.items():
            query = query.eq(col, val)
        response = query.execute()
        logger.info(f"Updated {len(response.data)} rows in {table}")
        return response.data
    except Exception as e:
        logger.error(f"Update failed for table {table}: {str(e)}")
        raise Exception(f"Update failed for table {table}: {str(e)}")


def delete_data(table: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Delete data from a Supabase table."""
    try:
        query = supabase.table(table).delete()
        for col, val in filters.items():
            query = query.eq(col, val)
        response = query.execute()
        logger.info(f"Deleted {len(response.data)} rows from {table}")
        return response.data
    except Exception as e:
        logger.error(f"Delete failed for table {table}: {str(e)}")
        raise Exception(f"Delete failed for table {table}: {str(e)}")


def count_records(table: str, filters: Optional[Dict[str, Any]] = None) -> int:
    """Count records in a table with optional filters."""
    try:
        query = supabase.table(table).select("*", count="exact")
        if filters:
            for col, val in filters.items():
                if isinstance(val, list):
                    query = query.in_(col, val)
                else:
                    query = query.eq(col, val)
        response = query.execute()
        count = response.count if response.count is not None else 0
        logger.info(f"Counted {count} records in {table}")
        return count
    except Exception as e:
        logger.error(f"Count failed for table {table}: {str(e)}")
        raise Exception(f"Count failed for table {table}: {str(e)}")


# Advanced Query Functions
def get_paginated_data(table: str, page: int = 1, per_page: int = 20,
                      filters: Optional[Dict[str, Any]] = None,
                      select_fields: str = "*", order_by: Optional[str] = None) -> Tuple[List[Dict[str, Any]], int]:
    """Get paginated data with total count."""
    try:
        # Get total count
        total = count_records(table, filters)
        
        # Calculate offset
        offset = (page - 1) * per_page
        
        # Get data
        data = get_data(
            table=table,
            filters=filters,
            select_fields=select_fields,
            order_by=order_by,
            limit=per_page,
            offset=offset
        )
        
        return data, total
    except Exception as e:
        logger.error(f"Paginated fetch failed for table {table}: {str(e)}")
        raise Exception(f"Paginated fetch failed for table {table}: {str(e)}")


def search_data(table: str, search_fields: List[str], search_term: str,
               filters: Optional[Dict[str, Any]] = None,
               select_fields: str = "*", order_by: Optional[str] = None,
               limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Search data in multiple fields using ILIKE."""
    try:
        query = supabase.table(table).select(select_fields)
        
        # Add search conditions
        if search_term:
            search_conditions = []
            for field in search_fields:
                search_conditions.append(f"{field}.ilike.%{search_term}%")
            if search_conditions:
                query = query.or_(",".join(search_conditions))
        
        # Add filters
        if filters:
            for col, val in filters.items():
                if isinstance(val, list):
                    query = query.in_(col, val)
                else:
                    query = query.eq(col, val)
        
        # Add ordering
        if order_by:
            desc = order_by.startswith('-')
            field = order_by.lstrip('-')
            query = query.order(field, desc=desc)
        
        # Add limit
        if limit:
            query = query.limit(limit)
        
        response = query.execute()
        logger.info(f"Search returned {len(response.data)} results from {table}")
        return response.data
    except Exception as e:
        logger.error(f"Search failed for table {table}: {str(e)}")
        raise Exception(f"Search failed for table {table}: {str(e)}")


def execute_rpc(function_name: str, params: Optional[Dict[str, Any]] = None) -> Any:
    """Execute a Supabase RPC function."""
    try:
        if params:
            response = supabase.rpc(function_name, params).execute()
        else:
            response = supabase.rpc(function_name).execute()
        logger.info(f"Executed RPC function {function_name}")
        return response.data
    except Exception as e:
        logger.error(f"RPC execution failed for {function_name}: {str(e)}")
        raise Exception(f"RPC execution failed for {function_name}: {str(e)}")


# Authentication Functions
def sign_up_user(email: str, password: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Sign up a new user."""
    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": metadata} if metadata else {}
        })
        logger.info(f"User signed up: {email}")
        return response
    except Exception as e:
        logger.error(f"Sign up failed for {email}: {str(e)}")
        raise Exception(f"Sign up failed: {str(e)}")


def sign_in_user(email: str, password: str) -> Dict[str, Any]:
    """Sign in user."""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        logger.info(f"User signed in: {email}")
        return response
    except Exception as e:
        logger.error(f"Sign in failed for {email}: {str(e)}")
        raise Exception(f"Sign in failed: {str(e)}")


def get_user_from_token(token: str) -> Dict[str, Any]:
    """Get user from JWT token."""
    try:
        response = supabase.auth.get_user(token)
        return response
    except Exception as e:
        logger.error(f"Get user from token failed: {str(e)}")
        raise Exception(f"Get user failed: {str(e)}")


def refresh_token(refresh_token: str) -> Dict[str, Any]:
    """Refresh access token."""
    try:
        response = supabase.auth.refresh_session(refresh_token)
        logger.info("Token refreshed successfully")
        return response
    except Exception as e:
        logger.error(f"Token refresh failed: {str(e)}")
        raise Exception(f"Token refresh failed: {str(e)}")


def sign_out_user(token: str) -> Dict[str, Any]:
    """Sign out user."""
    try:
        response = supabase.auth.sign_out()
        logger.info("User signed out")
        return response
    except Exception as e:
        logger.error(f"Sign out failed: {str(e)}")
        raise Exception(f"Sign out failed: {str(e)}")


# File Storage Operations
def upload_file(bucket: str, file_path: str, file_name: str, 
               content_type: Optional[str] = None) -> str:
    """Upload file to Supabase storage."""
    try:
        with open(file_path, "rb") as f:
            file_options = {"content-type": content_type} if content_type else {}
            response = supabase.storage.from_(bucket).upload(
                file_name, f, file_options=file_options
            )
        
        if hasattr(response, 'error') and response.error:
            raise Exception(f"File upload failed: {response.error}")
        
        public_url = get_public_url(bucket, file_name)
        logger.info(f"File uploaded successfully: {file_name}")
        return public_url
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        raise Exception(f"File upload failed: {str(e)}")


def upload_file_from_bytes(bucket: str, file_name: str, file_bytes: bytes,
                          content_type: Optional[str] = None) -> str:
    """Upload file from bytes to Supabase storage."""
    try:
        file_options = {"content-type": content_type} if content_type else {}
        response = supabase.storage.from_(bucket).upload(
            file_name, file_bytes, file_options=file_options
        )
        
        if hasattr(response, 'error') and response.error:
            raise Exception(f"File upload failed: {response.error}")
        
        public_url = get_public_url(bucket, file_name)
        logger.info(f"File uploaded from bytes successfully: {file_name}")
        return public_url
    except Exception as e:
        logger.error(f"File upload from bytes failed: {str(e)}")
        raise Exception(f"File upload from bytes failed: {str(e)}")


def get_public_url(bucket: str, file_name: str) -> str:
    """Get public URL for a file."""
    try:
        response = supabase.storage.from_(bucket).get_public_url(file_name)
        return response
    except Exception as e:
        logger.error(f"Getting public URL failed: {str(e)}")
        raise Exception(f"Getting public URL failed: {str(e)}")


def delete_file(bucket: str, file_name: str) -> bool:
    """Delete file from storage."""
    try:
        response = supabase.storage.from_(bucket).remove([file_name])
        if hasattr(response, 'error') and response.error:
            raise Exception(f"File deletion failed: {response.error}")
        logger.info(f"File deleted successfully: {file_name}")
        return True
    except Exception as e:
        logger.error(f"File deletion failed: {str(e)}")
        raise Exception(f"File deletion failed: {str(e)}")


def list_files(bucket: str, folder: Optional[str] = None) -> List[Dict[str, Any]]:
    """List files in a storage bucket."""
    try:
        path = folder if folder else ""
        response = supabase.storage.from_(bucket).list(path)
        if hasattr(response, 'error') and response.error:
            raise Exception(f"List files failed: {response.error}")
        return response
    except Exception as e:
        logger.error(f"List files failed: {str(e)}")
        raise Exception(f"List files failed: {str(e)}")


# Specialized Database Functions
def get_issues_with_details(filters: Optional[Dict[str, Any]] = None, 
                           page: int = 1, per_page: int = 20,
                           order_by: str = "-created_at") -> Tuple[List[Dict[str, Any]], int]:
    """Get issues with citizen details and statistics."""
    try:
        select_query = """
            *,
            profiles!citizen_id(full_name, phone),
            issue_assignments!issue_id(count),
            issue_updates!issue_id(count)
        """
        
        return get_paginated_data(
            table="issues",
            page=page,
            per_page=per_page,
            filters=filters,
            select_fields=select_query,
            order_by=order_by
        )
    except Exception as e:
        logger.error(f"Get issues with details failed: {str(e)}")
        raise Exception(f"Get issues with details failed: {str(e)}")


def get_assignments_with_details(filters: Optional[Dict[str, Any]] = None,
                                page: int = 1, per_page: int = 20) -> Tuple[List[Dict[str, Any]], int]:
    """Get assignments with staff and issue details."""
    try:
        select_query = """
            *,
            staff:profiles!staff_id(full_name, department),
            assigned_by_profile:profiles!assigned_by(full_name),
            issues!issue_id(title, category, status)
        """
        
        return get_paginated_data(
            table="issue_assignments",
            page=page,
            per_page=per_page,
            filters=filters,
            select_fields=select_query,
            order_by="-assigned_at"
        )
    except Exception as e:
        logger.error(f"Get assignments with details failed: {str(e)}")
        raise Exception(f"Get assignments with details failed: {str(e)}")


def get_updates_with_details(filters: Optional[Dict[str, Any]] = None,
                            page: int = 1, per_page: int = 20) -> Tuple[List[Dict[str, Any]], int]:
    """Get issue updates with staff details."""
    try:
        select_query = """
            *,
            profiles!staff_id(full_name, department),
            issues!issue_id(title, category)
        """
        
        return get_paginated_data(
            table="issue_updates",
            page=page,
            per_page=per_page,
            filters=filters,
            select_fields=select_query,
            order_by="-created_at"
        )
    except Exception as e:
        logger.error(f"Get updates with details failed: {str(e)}")
        raise Exception(f"Get updates with details failed: {str(e)}")


def get_user_vote_status(user_id: str, issue_ids: List[int]) -> Dict[int, bool]:
    """Get user's vote status for multiple issues."""
    try:
        votes = get_data(
            table="issue_votes",
            filters={"user_id": user_id, "issue_id": issue_ids}
        )
        
        vote_status = {issue_id: False for issue_id in issue_ids}
        for vote in votes:
            vote_status[vote["issue_id"]] = True
        
        return vote_status
    except Exception as e:
        logger.error(f"Get user vote status failed: {str(e)}")
        raise Exception(f"Get user vote status failed: {str(e)}")


def get_department_stats() -> List[Dict[str, Any]]:
    """Get statistics by department."""
    try:
        # This would typically be a database view or stored procedure
        # For now, we'll calculate it programmatically
        departments = get_data(
            table="profiles",
            select_fields="department",
            filters={"role": {"operator": "in", "value": ["staff", "supervisor"]}}
        )
        
        unique_departments = list(set([d["department"] for d in departments if d["department"]]))
        
        dept_stats = []
        for dept in unique_departments:
            if not dept:
                continue
                
            # Get staff count
            staff_count = count_records("profiles", {"department": dept, "role": "staff"})
            
            # Get issues assigned to this department
            staff_ids = [p["id"] for p in get_data("profiles", {"department": dept, "role": "staff"})]
            if staff_ids:
                assignments = get_data("issue_assignments", {"staff_id": staff_ids})
                issue_ids = [a["issue_id"] for a in assignments]
                
                if issue_ids:
                    total_issues = len(set(issue_ids))
                    pending_issues = count_records("issues", {
                        "id": issue_ids,
                        "status": "pending"
                    })
                    in_progress_issues = count_records("issues", {
                        "id": issue_ids,
                        "status": "in_progress"
                    })
                    resolved_issues = count_records("issues", {
                        "id": issue_ids,
                        "status": "resolved"
                    })
                else:
                    total_issues = pending_issues = in_progress_issues = resolved_issues = 0
            else:
                total_issues = pending_issues = in_progress_issues = resolved_issues = 0
            
            dept_stats.append({
                "department": dept,
                "total_staff": staff_count,
                "total_issues": total_issues,
                "pending_issues": pending_issues,
                "in_progress_issues": in_progress_issues,
                "resolved_issues": resolved_issues
            })
        
        return dept_stats
    except Exception as e:
        logger.error(f"Get department stats failed: {str(e)}")
        raise Exception(f"Get department stats failed: {str(e)}")


# Bulk Operations
def bulk_insert(table: str, data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Insert multiple records at once."""
    try:
        response = supabase.table(table).insert(data_list).execute()
        logger.info(f"Bulk inserted {len(response.data)} records into {table}")
        return response.data
    except Exception as e:
        logger.error(f"Bulk insert failed for table {table}: {str(e)}")
        raise Exception(f"Bulk insert failed for table {table}: {str(e)}")


def bulk_update(table: str, updates: List[Dict[str, Any]], match_key: str) -> List[Dict[str, Any]]:
    """Update multiple records at once."""
    try:
        results = []
        for update_data in updates:
            match_value = update_data.pop(match_key)
            result = update_data(table, {match_key: match_value}, update_data)
            results.extend(result)
        logger.info(f"Bulk updated {len(results)} records in {table}")
        return results
    except Exception as e:
        logger.error(f"Bulk update failed for table {table}: {str(e)}")
        raise Exception(f"Bulk update failed for table {table}: {str(e)}")


# Analytics and Reporting Functions
def get_issue_trends(days: int = 30) -> Dict[str, List[Dict[str, Any]]]:
    """Get issue creation and resolution trends."""
    try:
        # This would typically use database functions for better performance
        # For now, we'll do basic aggregation
        end_date = datetime.now()
        start_date = end_date.replace(day=end_date.day - days)
        
        issues_created = get_data(
            "issues",
            filters={
                "created_at": {
                    "operator": "gte",
                    "value": start_date.isoformat()
                }
            },
            select_fields="created_at, status"
        )
        
        # Group by date
        trends = {}
        for issue in issues_created:
            date_str = issue["created_at"][:10]  # Get date part
            if date_str not in trends:
                trends[date_str] = {"created": 0, "resolved": 0}
            trends[date_str]["created"] += 1
            if issue["status"] == "resolved":
                trends[date_str]["resolved"] += 1
        
        # Convert to list format
        created_trend = [{"date": date, "count": data["created"]} for date, data in trends.items()]
        resolved_trend = [{"date": date, "count": data["resolved"]} for date, data in trends.items()]
        
        return {
            "issues_created": sorted(created_trend, key=lambda x: x["date"]),
            "issues_resolved": sorted(resolved_trend, key=lambda x: x["date"])
        }
    except Exception as e:
        logger.error(f"Get issue trends failed: {str(e)}")
        raise Exception(f"Get issue trends failed: {str(e)}")


# Connection health check
def health_check() -> bool:
    """Check if Supabase connection is healthy."""
    try:
        # Simple query to test connection
        response = supabase.table("profiles").select("id").limit(1).execute()
        return True
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return False