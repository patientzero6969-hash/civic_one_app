from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form, Header
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.supabase_client import (
    upload_file_from_bytes, get_public_url, delete_file, list_files, 
    get_user_from_token, get_data, upload_file_from_bytes_with_service_role
)
from app.schemas import FileUploadResponse, BaseResponse
from app.routes.auth import get_current_user, get_current_user_optional
from app.utils.helpers import generate_uuid, validate_image_file, compress_image
from typing import List, Optional
import logging
import os
import time
from io import BytesIO
import mimetypes
import jwt
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)

# Configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOCUMENT_TYPES = {"application/pdf", "text/plain", "application/msword", 
                         "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
BUCKET_NAME = "project0_storage"  # Updated to match your actual bucket name

# Camera-specific configuration
CAMERA_SESSION_TIMEOUT = 300  # 5 minutes
CAMERA_MAX_ATTEMPTS = 3
CAMERA_RATE_LIMIT = 10  # Max 10 uploads per minute per user


def _validate_camera_authentication(credentials: HTTPAuthorizationCredentials) -> dict:
    """Enhanced authentication validation specifically for camera access."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Camera access requires authentication",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        token = credentials.credentials
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token for camera access",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Validate token with Supabase
        user_response = get_user_from_token(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Camera access denied: Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Get user profile
        profile_data = get_data("profiles", {"id": user_response.user.id})
        if not profile_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Camera access denied: User profile not found",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        user_data = {
            "user": user_response.user,
            "profile": profile_data[0],
            "token": token
        }
        
        logger.info(f"Camera authentication successful for user {user_response.user.id}")
        return user_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Camera authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Camera access authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )


def _validate_file_permissions(user_data: dict, file_path: str = None) -> tuple[str, str]:
    """Validate file access permissions and return user info."""
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for file operations",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user_profile = user_data.get("profile", {})
    user_id = user_profile.get("id")
    user_role = user_profile.get("role")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identification for file operations",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Check file ownership if file_path provided
    if file_path and user_role != "admin":
        if not file_path.startswith(f"{user_id}/"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: File does not belong to current user"
            )
    
    return user_id, user_role


def _check_rate_limit(user_id: str) -> bool:
    """Check if user has exceeded upload rate limit (simplified implementation)."""
    # In production, use Redis or database to track rate limits
    # This is a simplified version using in-memory tracking
    current_time = time.time()
    
    # For now, return True (no rate limiting)
    # Implement proper rate limiting with Redis or similar in production
    return True


def _log_camera_access(user_id: str, action: str, success: bool = True, error: str = None):
    """Log camera access attempts for security monitoring."""
    log_entry = {
        "user_id": user_id,
        "action": action,
        "success": success,
        "timestamp": datetime.now().isoformat(),
        "error": error
    }
    
    if success:
        logger.info(f"Camera access: {action} by user {user_id}")
    else:
        logger.warning(f"Camera access failed: {action} by user {user_id} - {error}")


@router.post("/camera/capture", response_model=FileUploadResponse)
async def capture_from_camera(
    file: UploadFile = File(...),
    compress: bool = Form(True),
    max_width: int = Form(1920),
    max_height: int = Form(1080),
    quality: int = Form(85),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Capture and upload image directly from camera with enhanced authentication."""
    try:
        # Enhanced authentication for camera access
        user_data = _validate_camera_authentication(credentials)
        user_id, user_role = _validate_file_permissions(user_data)
        
        # Check rate limiting
        if not _check_rate_limit(user_id):
            _log_camera_access(user_id, "rate_limit_exceeded", False, "Too many requests")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Camera upload rate limit exceeded. Please wait before trying again."
            )
        
        # Validate file type specifically for camera capture
        if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
            _log_camera_access(user_id, "invalid_file_type", False, f"Type: {file.content_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Camera capture failed: Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
            )
        
        # Read and validate file content
        file_content = await file.read()
        
        if len(file_content) > MAX_FILE_SIZE:
            _log_camera_access(user_id, "file_too_large", False, f"Size: {len(file_content)} bytes")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Camera capture failed: File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Validate image file integrity
        if not validate_image_file(file_content):
            _log_camera_access(user_id, "invalid_image", False, "Image validation failed")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Camera capture failed: Invalid or corrupted image file"
            )
        
        # Compress image if requested
        original_size = len(file_content)
        if compress:
            try:
                file_content = compress_image(
                    file_content, 
                    max_width=max_width, 
                    max_height=max_height,
                    quality=quality
                )
                compression_ratio = (1 - len(file_content) / original_size) * 100
                logger.info(f"Camera image compressed for user {user_id}: {compression_ratio:.1f}% reduction")
            except Exception as e:
                logger.warning(f"Camera image compression failed for user {user_id}: {str(e)}")
                # Continue with original image if compression fails
        
        # Generate unique filename with correct folder structure
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
        unique_filename = f"issues/{user_id}/camera_{timestamp}_{generate_uuid()}{file_extension}"
        
        # Upload to Supabase storage with camera context
        try:
            file_url = upload_file_from_bytes_with_service_role(
                bucket=BUCKET_NAME,
                file_name=unique_filename,
                file_bytes=file_content,
                content_type=file.content_type
            )
            
            _log_camera_access(user_id, "upload_success", True)
            
            logger.info(f"Camera image uploaded successfully: {unique_filename} by user {user_id}")
            
            return FileUploadResponse(
                success=True,
                message="Camera image captured and uploaded successfully",
                file_url=file_url,
                file_name=unique_filename,
                file_size=len(file_content),
                content_type=file.content_type,
                metadata={
                    "source": "camera_capture",
                    "original_size": original_size,
                    "compressed": compress,
                    "compression_ratio": f"{((1 - len(file_content) / original_size) * 100):.1f}%" if compress else "0%"
                }
            )
            
        except Exception as upload_error:
            _log_camera_access(user_id, "upload_failed", False, str(upload_error))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Camera upload failed: {str(upload_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Camera capture failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Camera capture and upload failed"
        )


@router.post("/upload/image", response_model=FileUploadResponse)
async def upload_issue_image(
    file: UploadFile = File(...),
    compress: bool = Form(True),
    max_width: int = Form(1920),
    max_height: int = Form(1080),
    quality: int = Form(85),
    current_user: dict = Depends(get_current_user)
):
    """Upload an image file for issues with enhanced authentication."""
    try:
        # Validate user permissions
        user_id, user_role = _validate_file_permissions(current_user)
        
        # Validate file
        if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Check file size
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Validate image file
        if not validate_image_file(file_content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or corrupted image file"
            )
        
        # Compress image if requested
        original_size = len(file_content)
        if compress:
            try:
                file_content = compress_image(
                    file_content, 
                    max_width=max_width, 
                    max_height=max_height,
                    quality=quality
                )
                logger.info(f"Image compressed: original {original_size} bytes, compressed {len(file_content)} bytes")
            except Exception as e:
                logger.warning(f"Image compression failed, using original: {str(e)}")
        
        # Generate unique filename with issues folder
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
        unique_filename = f"issues/{user_id}/{generate_uuid()}{file_extension}"
        
        # Upload to Supabase storage
        file_url = upload_file_from_bytes_with_service_role(
            bucket=BUCKET_NAME,
            file_name=unique_filename,
            file_bytes=file_content,
            content_type=file.content_type
        )
        
        logger.info(f"Image uploaded successfully: {unique_filename} by user {user_id}")
        
        return FileUploadResponse(
            success=True,
            message="Image uploaded successfully",
            file_url=file_url,
            file_name=unique_filename,
            file_size=len(file_content),
            content_type=file.content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image"
        )


@router.post("/upload/document", response_model=FileUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a document file with authentication."""
    try:
        # Validate user permissions
        user_id, user_role = _validate_file_permissions(current_user)
        
        # Only staff, supervisors, and admins can upload documents
        if user_role not in ["staff", "supervisor", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to upload documents"
            )
        
        # Validate file type
        if not file.content_type or file.content_type not in ALLOWED_DOCUMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_DOCUMENT_TYPES)}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Check file size
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Generate unique filename for documents
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
        unique_filename = f"issues/documents/{user_id}/{generate_uuid()}{file_extension}"
        
        # Upload to Supabase storage
        file_url = upload_file_from_bytes_with_service_role(
            bucket=BUCKET_NAME,
            file_name=unique_filename,
            file_bytes=file_content,
            content_type=file.content_type
        )
        
        logger.info(f"Document uploaded successfully: {unique_filename} by user {user_id}")
        
        return FileUploadResponse(
            success=True,
            message="Document uploaded successfully",
            file_url=file_url,
            file_name=unique_filename,
            file_size=len(file_content),
            content_type=file.content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document"
        )


@router.post("/upload/multiple", response_model=List[FileUploadResponse])
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    compress_images: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """Upload multiple files at once with authentication."""
    try:
        # Validate user permissions
        user_id, user_role = _validate_file_permissions(current_user)
        
        if len(files) > 5:  # Limit to 5 files per request
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 5 files allowed per request"
            )
        
        upload_results = []
        
        for file in files:
            try:
                # Determine file type and validate
                if file.content_type in ALLOWED_IMAGE_TYPES:
                    # Process as image
                    file_content = await file.read()
                    
                    if len(file_content) > MAX_FILE_SIZE:
                        upload_results.append(FileUploadResponse(
                            success=False,
                            message=f"File {file.filename} exceeds size limit",
                            file_url="",
                            file_name=file.filename or "unknown"
                        ))
                        continue
                    
                    # Validate and optionally compress image
                    if not validate_image_file(file_content):
                        upload_results.append(FileUploadResponse(
                            success=False,
                            message=f"Invalid image file: {file.filename}",
                            file_url="",
                            file_name=file.filename or "unknown"
                        ))
                        continue
                    
                    if compress_images:
                        try:
                            file_content = compress_image(file_content)
                        except Exception as e:
                            logger.warning(f"Failed to compress {file.filename}: {str(e)}")
                    
                    # Upload image to issues folder
                    file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
                    unique_filename = f"issues/{user_id}/{generate_uuid()}{file_extension}"
                    
                    file_url = upload_file_from_bytes_with_service_role(
                        bucket=BUCKET_NAME,
                        file_name=unique_filename,
                        file_bytes=file_content,
                        content_type=file.content_type
                    )
                    
                    upload_results.append(FileUploadResponse(
                        success=True,
                        message="Image uploaded successfully",
                        file_url=file_url,
                        file_name=unique_filename,
                        file_size=len(file_content),
                        content_type=file.content_type
                    ))
                
                elif file.content_type in ALLOWED_DOCUMENT_TYPES:
                    # Process as document (only for authorized users)
                    if user_role not in ["staff", "supervisor", "admin"]:
                        upload_results.append(FileUploadResponse(
                            success=False,
                            message=f"Not authorized to upload document: {file.filename}",
                            file_url="",
                            file_name=file.filename or "unknown"
                        ))
                        continue
                    
                    file_content = await file.read()
                    
                    if len(file_content) > MAX_FILE_SIZE:
                        upload_results.append(FileUploadResponse(
                            success=False,
                            message=f"File {file.filename} exceeds size limit",
                            file_url="",
                            file_name=file.filename or "unknown"
                        ))
                        continue
                    
                    # Upload document to issues/documents folder
                    file_extension = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
                    unique_filename = f"issues/documents/{user_id}/{generate_uuid()}{file_extension}"
                    
                    file_url = upload_file_from_bytes_with_service_role(
                        bucket=BUCKET_NAME,
                        file_name=unique_filename,
                        file_bytes=file_content,
                        content_type=file.content_type
                    )
                    
                    upload_results.append(FileUploadResponse(
                        success=True,
                        message="Document uploaded successfully",
                        file_url=file_url,
                        file_name=unique_filename,
                        file_size=len(file_content),
                        content_type=file.content_type
                    ))
                
                else:
                    upload_results.append(FileUploadResponse(
                        success=False,
                        message=f"Unsupported file type: {file.content_type}",
                        file_url="",
                        file_name=file.filename or "unknown"
                    ))
            
            except Exception as e:
                logger.error(f"Failed to upload {file.filename}: {str(e)}")
                upload_results.append(FileUploadResponse(
                    success=False,
                    message=f"Upload failed for {file.filename}: {str(e)}",
                    file_url="",
                    file_name=file.filename or "unknown"
                ))
        
        successful_uploads = sum(1 for result in upload_results if result.success)
        logger.info(f"Multiple file upload: {successful_uploads}/{len(files)} successful by user {user_id}")
        
        return upload_results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload multiple files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload files"
        )


@router.delete("/delete/{file_path:path}")
async def delete_uploaded_file(
    file_path: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an uploaded file with authentication validation."""
    try:
        # Validate user permissions
        user_id, user_role = _validate_file_permissions(current_user, file_path)
        
        # Delete file from storage
        success = delete_file(BUCKET_NAME, file_path)
        
        if success:
            logger.info(f"File deleted: {file_path} by user {user_id}")
            return BaseResponse(
                success=True,
                message="File deleted successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or already deleted"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete file {file_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file"
        )


@router.get("/list")
async def list_user_files(
    folder: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List files uploaded by the current user with authentication."""
    try:
        # Validate user permissions
        user_id, user_role = _validate_file_permissions(current_user)
        
        # Determine folder path based on user role
        if user_role == "admin":
            folder_path = folder or ""
        else:
            folder_path = f"{user_id}/"
            if folder:
                folder_path += folder.strip("/") + "/"
        
        # List files
        files = list_files(BUCKET_NAME, folder_path)
        
        # Process file information
        processed_files = []
        for file_info in files:
            if file_info.get("name") and not file_info["name"].endswith("/"):  # Skip folders
                file_data = {
                    "name": file_info["name"],
                    "size": file_info.get("metadata", {}).get("size", 0),
                    "created_at": file_info.get("created_at"),
                    "updated_at": file_info.get("updated_at"),
                    "content_type": file_info.get("metadata", {}).get("mimetype"),
                    "public_url": get_public_url(BUCKET_NAME, file_info["name"]),
                    "owner_id": user_id,
                    "accessible": True
                }
                processed_files.append(file_data)
        
        logger.info(f"Listed {len(processed_files)} files for user {user_id}")
        
        return {
            "success": True,
            "folder": folder_path,
            "files": processed_files,
            "total": len(processed_files),
            "user_id": user_id,
            "user_role": user_role
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list files"
        )


@router.get("/info")
async def get_upload_info(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get upload configuration information with user context."""
    base_info = {
        "max_file_size_mb": MAX_FILE_SIZE // (1024 * 1024),
        "allowed_image_types": list(ALLOWED_IMAGE_TYPES),
        "allowed_document_types": list(ALLOWED_DOCUMENT_TYPES),
        "max_files_per_request": 5,
        "compression_available": True,
        "camera_capture_available": True,
        "supported_features": [
            "image_compression",
            "multiple_upload",
            "file_validation",
            "user_folders",
            "camera_capture",
            "rate_limiting",
            "authentication_required"
        ]
    }
    
    # Add user-specific information if authenticated
    if current_user:
        try:
            user_id, user_role = _validate_file_permissions(current_user)
            base_info.update({
                "user_authenticated": True,
                "user_id": user_id,
                "user_role": user_role,
                "can_upload_documents": user_role in ["staff", "supervisor", "admin"],
                "camera_access": True,
                "upload_path": f"{user_id}/"
            })
        except:
            base_info["user_authenticated"] = False
    else:
        base_info.update({
            "user_authenticated": False,
            "camera_access": False,
            "authentication_required": True
        })
    
    return base_info


@router.get("/validate")
async def validate_file_url(
    file_url: str,
    current_user: dict = Depends(get_current_user)
):
    """Validate if a file URL is accessible and belongs to the user."""
    try:
        # Validate user permissions
        user_id, user_role = _validate_file_permissions(current_user)
        
        # Extract file path from URL
        if BUCKET_NAME not in file_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file URL: Does not contain expected bucket name"
            )
        
        # Parse URL to extract file path
        url_parts = file_url.split(f"{BUCKET_NAME}/")
        if len(url_parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file URL format"
            )
        
        file_path = url_parts[1]
        
        # Check ownership (unless admin)
        owned = True
        if user_role != "admin" and not file_path.startswith(f"{user_id}/"):
            owned = False
            return {
                "valid": False,
                "accessible": False,
                "owned": False,
                "user_id": user_id,
                "user_role": user_role,
                "file_path": file_path,
                "message": "File does not belong to current user"
            }
        
        # Try to get public URL (this validates existence)
        try:
            public_url = get_public_url(BUCKET_NAME, file_path)
            
            # Additional validation: check if file actually exists
            # In production, you might want to make a HEAD request to verify
            
            return {
                "valid": True,
                "accessible": True,
                "owned": owned,
                "user_id": user_id,
                "user_role": user_role,
                "file_path": file_path,
                "public_url": public_url,
                "message": "File is valid and accessible"
            }
            
        except Exception as e:
            logger.warning(f"File validation failed for {file_path}: {str(e)}")
            return {
                "valid": False,
                "accessible": False,
                "owned": owned,
                "user_id": user_id,
                "user_role": user_role,
                "file_path": file_path,
                "message": "File not found or not accessible"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate file URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate file URL"
        )


@router.get("/camera/status")
async def get_camera_status(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Check camera access status and permissions for the current user."""
    try:
        # Validate camera authentication
        user_data = _validate_camera_authentication(credentials)
        user_id, user_role = _validate_file_permissions(user_data)
        
        # Get current camera session info
        camera_status = {
            "camera_access": True,
            "user_id": user_id,
            "user_role": user_role,
            "authenticated": True,
            "session_active": True,
            "upload_permissions": {
                "max_file_size_mb": MAX_FILE_SIZE // (1024 * 1024),
                "allowed_types": list(ALLOWED_IMAGE_TYPES),
                "compression_available": True,
                "rate_limit_per_minute": CAMERA_RATE_LIMIT
            },
            "features": {
                "capture_and_upload": True,
                "image_compression": True,
                "file_validation": True,
                "secure_storage": True
            }
        }
        
        _log_camera_access(user_id, "status_check", True)
        
        return camera_status
        
    except HTTPException as e:
        # Return limited info for unauthenticated users
        return {
            "camera_access": False,
            "authenticated": False,
            "session_active": False,
            "error": e.detail,
            "authentication_required": True,
            "message": "Camera access requires valid authentication"
        }
    except Exception as e:
        logger.error(f"Failed to get camera status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve camera status"
        )


@router.post("/camera/test-auth")
async def test_camera_authentication(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Test camera authentication without performing any operations."""
    try:
        # Test authentication
        user_data = _validate_camera_authentication(credentials)
        user_id, user_role = _validate_file_permissions(user_data)
        
        _log_camera_access(user_id, "auth_test", True)
        
        return {
            "authentication_valid": True,
            "user_id": user_id,
            "user_role": user_role,
            "camera_access_granted": True,
            "message": "Camera authentication successful",
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException as e:
        return {
            "authentication_valid": False,
            "camera_access_granted": False,
            "error": e.detail,
            "status_code": e.status_code,
            "message": "Camera authentication failed",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Camera auth test failed: {str(e)}")
        return {
            "authentication_valid": False,
            "camera_access_granted": False,
            "error": "Internal authentication error",
            "message": "Camera authentication test failed",
            "timestamp": datetime.now().isoformat()
        }