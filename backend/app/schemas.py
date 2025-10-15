# app/schemas.py - Complete schemas file with ALL required imports for dashboard
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Literal, List, Union, Dict, Any
from datetime import datetime
import re


# Base response models
class BaseResponse(BaseModel):
    """Base response model with common fields."""
    success: bool = True
    message: Optional[str] = None


class PaginationResponse(BaseModel):
    """Pagination metadata."""
    total: int
    page: int
    per_page: int
    total_pages: int
    has_next: bool
    has_prev: bool


# User/Profile schemas
class ProfileBase(BaseModel):
    """Base profile model."""
    full_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Literal["citizen", "admin", "supervisor", "staff"] = "citizen"
    department: Optional[str] = Field(None, max_length=50)

    @validator('phone')
    def validate_phone(cls, v):
        if v is None or v == "":
            return v
        
        # Remove all non-digit characters for validation
        digits_only = re.sub(r'\D', '', v)
        
        # Allow phone numbers with 10-15 digits
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError('Phone number must be between 10-15 digits')
        
        # Return the original value (keep formatting)
        return v


class ProfileCreate(ProfileBase):
    """Schema for creating profiles."""
    pass


class ProfileUpdate(BaseModel):
    """Schema for updating profiles."""
    full_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department: Optional[str] = Field(None, max_length=50)

    @validator('phone')
    def validate_phone(cls, v):
        if v is None or v == "":
            return v
        
        # Remove all non-digit characters for validation
        digits_only = re.sub(r'\D', '', v)
        
        # Allow phone numbers with 10-15 digits
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError('Phone number must be between 10-15 digits')
        
        # Return the original value (keep formatting)
        return v


class ProfileResponse(ProfileBase):
    """Profile response model."""
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Authentication schemas
class UserRegister(BaseModel):
    """User registration schema."""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        return v

    @validator('phone')
    def validate_phone(cls, v):
        if v is None or v == "":
            return v
        
        # Remove all non-digit characters for validation
        digits_only = re.sub(r'\D', '', v)
        
        # Allow phone numbers with 10-15 digits
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError('Phone number must be between 10-15 digits')
        
        # Return the original value (keep formatting)
        return v


class UserLogin(BaseModel):
    """User login schema."""
    email: EmailStr
    password: str

class UserRegisterWithRole(BaseModel):
    """User registration with role schema."""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[str] = None
    department: Optional[str] = None

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        return v

    @validator('phone')
    def validate_phone(cls, v):
        if v is None or v == "":
            return v
        
        digits_only = re.sub(r'\D', '', v)
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError('Phone number must be between 10-15 digits')
        
        return v

class AuthResponse(BaseResponse):
    """Authentication response."""
    access_token: str
    token_type: str = "bearer"
    user: ProfileResponse


class TokenResponse(BaseModel):
    """Token validation response."""
    valid: bool
    user: Optional[ProfileResponse] = None


# Issue schemas
class IssueBase(BaseModel):
    """Base issue model."""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    category: Literal[
        # Standard categories
        "roads", "waste", "water", "streetlight", "other",
        # Load test categories (for backward compatibility)
        "potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"
    ]
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = "medium"
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    image_url: Optional[str] = Field(None, max_length=500)


class IssueCreate(IssueBase):
    """Schema for creating issues."""
    citizen_id: Optional[str] = None  # Will be set automatically for citizens


class IssueUpdate(BaseModel):
    """Schema for updating issues."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    category: Optional[Literal[
        "roads", "waste", "water", "streetlight", "other",
        "potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"
    ]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    status: Optional[Literal["pending", "in_progress", "resolved"]] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    image_url: Optional[str] = Field(None, max_length=500)


class IssueResponse(IssueBase):
    """Issue response model."""
    id: int
    citizen_id: str
    status: Literal["pending", "in_progress", "resolved"]
    upvotes: int = 0
    created_at: datetime
    updated_at: datetime
    citizen_name: Optional[str] = None
    citizen_phone: Optional[str] = None
    assignment_count: Optional[int] = 0
    update_count: Optional[int] = 0
    days_open: Optional[int] = 0
    user_has_voted: Optional[bool] = False

    class Config:
        from_attributes = True


class IssueListResponse(BaseResponse):
    """Issue list response with pagination."""
    issues: List[IssueResponse]
    pagination: PaginationResponse


class IssueSearchRequest(BaseModel):
    """Issue search request."""
    query: Optional[str] = None
    category: Optional[Literal[
        "roads", "waste", "water", "streetlight", "other",
        "potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"
    ]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    status: Optional[Literal["pending", "in_progress", "resolved"]] = None
    citizen_id: Optional[str] = None
    department: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_upvotes: Optional[int] = None
    has_location: Optional[bool] = None


# Vote schemas
class VoteResponse(BaseModel):
    """Vote response model."""
    issue_id: int
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Assignment schemas
class AssignmentBase(BaseModel):
    """Base assignment model."""
    issue_id: int
    staff_id: str  # Note: Despite the name, this can be staff OR supervisor ID
    assigned_by: Optional[str] = None  # Will be set automatically

class AssignmentCreate(AssignmentBase):
    """Schema for creating assignments."""
    notes: Optional[str] = Field(None, max_length=500)
class AssignmentUpdate(BaseModel):
    """Schema for updating assignments."""
    status: Literal["assigned", "in_progress", "completed"]
    notes: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=500)

class AssignmentResponse(AssignmentBase):
    """Assignment response model."""
    id: int
    assigned_at: datetime
    status: Literal["assigned", "in_progress", "completed"]
    staff_name: Optional[str] = None
    staff_department: Optional[str] = None
    staff_role: Optional[str] = None  # NEW: Include role to distinguish staff vs supervisor
    assigned_by_name: Optional[str] = None
    issue_title: Optional[str] = None
    issue_category: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# Add to backend/app/schemas.py
class SLAConfig(BaseModel):
    """SLA configuration model."""
    category: Literal[
        "roads", "waste", "water", "streetlight", "other",
        "potholes", "DamagedElectricalPoles", "Garbage", "WaterLogging", "FallenTrees"
    ]
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = "medium"
    deadline_hours: int = Field(..., gt=0, le=720)  # Max 30 days

# Database migration schema for adding priority to existing issues
class IssuePriorityUpdate(BaseModel):
    """Schema for updating issue priorities in bulk."""
    category_priority_mapping: Dict[str, str] = {
        "potholes": "medium",
        "DamagedElectricalPoles": "high", 
        "Garbage": "low",
        "WaterLogging": "urgent",
        "FallenTrees": "high",
        "roads": "medium",
        "waste": "low", 
        "water": "urgent",
        "streetlight": "high",
        "other": "medium"
    }
class EscalationRequest(BaseModel):
    """Escalation request model."""
    assignment_id: int
    reason: str = Field(..., min_length=10, max_length=500)
    escalate_to: Optional[str] = None  # supervisor/admin ID

class AssignmentListResponse(BaseResponse):
    """Assignment list response."""
    assignments: List[AssignmentResponse]
    pagination: PaginationResponse


# Issue Update schemas
class IssueUpdateBase(BaseModel):
    """Base issue update model."""
    issue_id: int
    staff_id: Optional[str] = None  # Will be set automatically
    update_text: str = Field(..., min_length=1, max_length=1000)


class IssueUpdateCreate(IssueUpdateBase):
    """Schema for creating issue updates."""
    pass


class IssueUpdateResponse(IssueUpdateBase):
    """Issue update response model."""
    id: int
    created_at: datetime
    staff_name: Optional[str] = None
    staff_department: Optional[str] = None

    class Config:
        from_attributes = True


class IssueUpdateListResponse(BaseResponse):
    """Issue update list response."""
    updates: List[IssueUpdateResponse]


# File upload schemas
class FileUploadResponse(BaseResponse):
    """File upload response."""
    file_url: str
    file_name: str
    file_size: Optional[int] = None
    content_type: Optional[str] = None


# Statistics schemas (REQUIRED BY DASHBOARD)
class IssueStats(BaseModel):
    """Issue statistics model."""
    total_issues: int
    pending_issues: int
    in_progress_issues: int
    resolved_issues: int
    issues_by_category: Dict[str, int]
    issues_by_department: Dict[str, int]
    avg_resolution_time: Optional[float] = None
    total_upvotes: int


class UserStats(BaseModel):
    """User statistics model."""
    total_users: int
    citizens: int
    staff: int
    supervisors: int
    admins: int
    users_by_department: Dict[str, int]


class SystemStats(BaseModel):
    """System statistics model."""
    total_assignments: int
    active_assignments: int
    completed_assignments: int
    total_updates: int
    avg_updates_per_issue: float


# Dashboard response schemas (REQUIRED BY DASHBOARD)
class DashboardResponse(BaseResponse):
    """Dashboard response with all statistics."""
    issue_stats: IssueStats
    user_stats: UserStats
    system_stats: SystemStats
    recent_issues: List[IssueResponse]
    recent_assignments: List[AssignmentResponse]
    recent_updates: List[IssueUpdateResponse]


class TrendData(BaseModel):
    """Trend data for charts."""
    date: str
    count: int


class TrendsResponse(BaseResponse):
    """Trends response."""
    issues_created: List[TrendData]
    issues_resolved: List[TrendData]
    issues_by_category: List[TrendData]


class DepartmentStats(BaseModel):
    """Department-specific statistics."""
    department: str
    total_issues: int
    pending_issues: int
    in_progress_issues: int
    resolved_issues: int
    total_staff: int
    avg_resolution_time: Optional[float] = None


class DepartmentStatsResponse(BaseResponse):
    """Department statistics response."""
    departments: List[DepartmentStats]


# Bulk operations schemas
class BulkAssignRequest(BaseModel):
    """Bulk assignment request."""
    issue_ids: List[int] = Field(..., min_items=1, max_items=50)
    staff_id: str  # Can be staff or supervisor ID
    notes: Optional[str] = Field(None, max_length=500)



class BulkStatusUpdate(BaseModel):
    """Bulk status update request."""
    issue_ids: List[int]
    status: Literal["pending", "in_progress", "resolved"]


class BulkOperationResponse(BaseResponse):
    """Bulk operation response."""
    processed: int
    failed: int
    errors: List[str] = []

# Notification schemas
class NotificationCreate(BaseModel):
    """Notification creation schema."""
    user_id: str
    title: str
    message: str
    type: Literal["info", "success", "warning", "error"] = "info"


class NotificationResponse(BaseModel):
    """Notification response."""
    id: int
    user_id: str
    title: str
    message: str
    type: str
    read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseResponse):
    """Notification list response."""
    notifications: List[NotificationResponse]
    unread_count: int


# Performance and Analytics schemas
class PerformanceMetrics(BaseModel):
    """Performance metrics model."""
    period: str
    department: str
    metrics: Dict[str, Any]


class AnalyticsResponse(BaseResponse):
    """Analytics response."""
    metrics: PerformanceMetrics

class BulkAssignRequest(BaseModel):
    """Bulk assignment request."""
    issue_ids: List[int] = Field(..., min_items=1, max_items=50)
    staff_id: str  # Can be staff or supervisor
    notes: Optional[str] = Field(None, max_length=500)

class AssignableUser(BaseModel):
    """Assignable user model."""
    id: str
    full_name: str
    role: Literal["staff", "supervisor"]
    department: Optional[str] = None
    active_assignments: int = 0
    is_available: bool = True

class AssignableUsersResponse(BaseResponse):
    """Assignable users response."""
    users: List[AssignableUser]
