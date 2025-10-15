# app/routes/auth.py - Updated with better error handling
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.supabase_client import (
    sign_up_user, sign_in_user, get_user_from_token, 
    insert_data, get_data, sign_out_user, update_data
)
from app.schemas import (
    UserLogin, UserRegister, AuthResponse, ProfileResponse, 
    TokenResponse, BaseResponse
)
from typing import Optional
import logging
from pydantic import BaseModel

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()
security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials
        user_response = get_user_from_token(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get profile data
        profile_data = get_data("profiles", {"id": user_response.user.id})
        if not profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        return {
            "user": user_response.user,
            "profile": profile_data[0],
            "token": token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """Get current user from JWT token, but don't raise error if not authenticated."""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_roles(allowed_roles: list):
    """Decorator to require specific roles."""
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user["profile"]["role"]
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}"
            )
        return current_user
    return role_checker

class UserRegisterWithRole(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: Optional[str] = None  # 'admin', 'staff', 'supervisor'
    department: Optional[str] = None

# In your app/routes/auth.py file, ONLY update the register function
# Find the existing register function and replace it with this:

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request):
    """Register a new user - supports both mobile app and web app."""
    try:
        # Get request body as JSON to handle both mobile and web formats
        body = await request.json()
        
        # Extract common fields (works for both mobile and web)
        email = body.get("email")
        password = body.get("password") 
        full_name = body.get("full_name") or body.get("fullname")  # Web uses 'fullname'
        phone = body.get("phone")
        
        # Web-specific field (ignored by mobile)
        role = body.get("role")  # This will be None for mobile apps
        logger.info(f"Received role from request: {role}")  # Debug log
        logger.info(f"Received request body: {body}")
        logger.info(f"Extracted email: {email}, role: {role}")
        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required"
            )
        
        # Create auth user first
        auth_response = sign_up_user(
            email=email, 
            password=password,
            metadata={"full_name": full_name}
        )
        
        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )
        
        user_id = auth_response.user.id
        
        # Determine the role to assign
        assigned_role = "citizen"  # default for mobile app
        assigned_department = None
        
        # If role is provided (from web app), validate and use it
        if role:
            logger.info(f"Processing role: {role}")  # Debug log
            # Map frontend roles to backend roles
            role_mapping = {
                'Admin': 'admin',
                'DepartmentStaff': 'staff', 
                'FieldSupervisor': 'supervisor'
            }
            
            mapped_role = role_mapping.get(role, role.lower() if isinstance(role, str) else 'citizen')
            logger.info(f"Mapped role: {mapped_role}")  # Debug log
            valid_roles = ["admin", "staff", "supervisor", "citizen"]
            
            if mapped_role in valid_roles:
                assigned_role = mapped_role
                
                # Get department from request body (web app) or assign default
                if assigned_role in ["staff", "supervisor"]:
                    assigned_department = body.get("department") or "Public Works"  # Use provided department or default
        
        # Check if profile already exists (in case of retry)
        existing_profile = get_data("profiles", {"id": user_id})
        
        if existing_profile:
            # Update existing profile
            profile_data = existing_profile[0]
            
            update_fields = {}
            if not profile_data.get("full_name") and full_name:
                update_fields["full_name"] = full_name
            if not profile_data.get("phone") and phone:
                update_fields["phone"] = phone
            # Always update role if provided (remove the "if not" condition)
            if assigned_role != "citizen":  # Only update if non-default role
                update_fields["role"] = assigned_role
            if assigned_department and not profile_data.get("department"):
                update_fields["department"] = assigned_department
            
            logger.info(f"Update fields being applied: {update_fields}")
                
            if update_fields:
                updated_profile = update_data("profiles", {"id": user_id}, update_fields)
                profile_data = updated_profile[0] if updated_profile else profile_data
            
            logger.info(f"Assigned role before update: {assigned_role}")
            logger.info(f"Profile data before update: {profile_data}")
                
        else:
            # Create new profile with role
            profile_data = {
                "id": user_id,
                "full_name": full_name,
                "phone": phone,
                "role": assigned_role,
                "department": assigned_department
            }
            
            profile_result = insert_data("profiles", profile_data)
            
            if not profile_result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user profile"
                )
            profile_data = profile_result[0]
        
        # Check if session exists (user might need email confirmation)
        if auth_response.session and auth_response.session.access_token:
            # User can login immediately
            access_token = auth_response.session.access_token
            message = f"Registration successful. Account created with {assigned_role} role."
        else:
            # User needs email confirmation
            access_token = "pending_confirmation"
            message = f"Registration successful. Please check your email to confirm your account. Role assignment ({assigned_role}) will be active after confirmation."
        
        return AuthResponse(
            success=True,
            message=message,
            access_token=access_token,
            user=ProfileResponse(**profile_data)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )


@router.post("/login", response_model=AuthResponse)
async def login(credentials: UserLogin):
    """Login user."""
    try:
        # Sign in user
        auth_response = sign_in_user(
            email=credentials.email,
            password=credentials.password
        )
        
        if not auth_response.user or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        user_id = auth_response.user.id
        access_token = auth_response.session.access_token
        
        # Get profile data with error handling
        try:
            profile_data = get_data("profiles", {"id": user_id})
            if not profile_data:
                # Create profile if it doesn't exist
                profile_data = {
                    "id": user_id,
                    "full_name": auth_response.user.user_metadata.get("full_name"),
                    "phone": auth_response.user.user_metadata.get("phone"),
                    "role": "citizen"
                }
                insert_data("profiles", profile_data)
                profile_data = [profile_data]
            
            # Clean phone number if it exists and is invalid
            profile = profile_data[0]
            if profile.get("phone"):
                import re
                digits_only = re.sub(r'\D', '', profile["phone"])
                if len(digits_only) < 10:
                    profile["phone"] = None  # Clear invalid phone number
            
            profile_response = ProfileResponse(**profile)
            
        except Exception as profile_error:
            logger.error(f"Profile handling error: {str(profile_error)}")
            # Create a minimal profile response
            profile_response = ProfileResponse(
                id=user_id,
                full_name=auth_response.user.user_metadata.get("full_name", "User"),
                phone=None,  # Set to None to avoid validation errors
                role="citizen",
                department=None,
                created_at=auth_response.user.created_at
            )
        
        logger.info(f"User logged in successfully: {credentials.email}")
        
        return AuthResponse(
            success=True,
            message="Login successful",
            access_token=access_token,
            user=profile_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error for {credentials.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


@router.post("/logout", response_model=BaseResponse)
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user."""
    try:
        # Sign out from Supabase (this invalidates the session)
        sign_out_user(current_user["token"])
        
        logger.info(f"User logged out successfully: {current_user['user'].email}")
        
        return BaseResponse(
            success=True,
            message="Logged out successfully"
        )
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        # Even if logout fails on server side, return success
        # as the client should discard the token anyway
        return BaseResponse(
            success=True,
            message="Logged out successfully"
        )


@router.get("/me", response_model=ProfileResponse)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile."""
    try:
        profile = current_user["profile"]
        
        # Clean phone number if it's invalid
        if profile.get("phone"):
            import re
            digits_only = re.sub(r'\D', '', profile["phone"])
            if len(digits_only) < 10:
                profile["phone"] = None
        
        return ProfileResponse(**profile)
    except Exception as e:
        logger.error(f"Get profile error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user profile"
        )


@router.post("/verify-token", response_model=TokenResponse)
async def verify_token(current_user: Optional[dict] = Depends(get_current_user_optional)):
    """Verify if the provided token is valid."""
    if current_user:
        try:
            profile = current_user["profile"]
            
            # Clean phone number if it's invalid
            if profile.get("phone"):
                import re
                digits_only = re.sub(r'\D', '', profile["phone"])
                if len(digits_only) < 10:
                    profile["phone"] = None
            
            return TokenResponse(
                valid=True,
                user=ProfileResponse(**profile)
            )
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return TokenResponse(valid=False)
    else:
        return TokenResponse(valid=False)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_access_token(current_user: dict = Depends(get_current_user)):
    """Refresh access token."""
    try:
        # In Supabase, we typically just return the current token
        # as tokens are long-lived. In production, you might want to
        # implement proper token refresh logic
        
        profile = current_user["profile"]
        
        # Clean phone number if it's invalid
        if profile.get("phone"):
            import re
            digits_only = re.sub(r'\D', '', profile["phone"])
            if len(digits_only) < 10:
                profile["phone"] = None
        
        return AuthResponse(
            success=True,
            message="Token is still valid",
            access_token=current_user["token"],
            user=ProfileResponse(**profile)
        )
        
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )


@router.get("/roles")
async def get_available_roles():
    """Get list of available user roles."""
    return {
        "roles": [
            {"value": "citizen", "label": "Citizen"},
            {"value": "staff", "label": "Staff"},
            {"value": "supervisor", "label": "Supervisor"},
            {"value": "admin", "label": "Administrator"}
        ]
    }


@router.get("/permissions")
async def get_user_permissions(current_user: dict = Depends(get_current_user)):
    """Get current user's permissions based on role."""
    user_role = current_user["profile"]["role"]
    
    permissions = {
        "citizen": [
            "create_issue",
            "view_own_issues",
            "vote_on_issues",
            "view_public_issues"
        ],
        "staff": [
            "view_assigned_issues",
            "update_issue_status",
            "create_issue_updates",
            "view_department_issues"
        ],
        "supervisor": [
            "assign_issues",
            "view_department_stats",
            "manage_staff_assignments",
            "approve_issue_resolutions"
        ],
        "admin": [
            "manage_users",
            "view_all_issues",
            "system_configuration",
            "access_analytics"
        ]
    }
    
    return {
        "role": user_role,
        "permissions": permissions.get(user_role, [])
    }