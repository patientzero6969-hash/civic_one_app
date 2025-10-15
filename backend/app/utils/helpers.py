import uuid
import hashlib
import secrets
import re
import os
from datetime import datetime, timedelta
from typing import Optional, Any, Dict, List, Union, Tuple
from PIL import Image
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


def current_timestamp() -> str:
    """Get current timestamp in ISO format."""
    return datetime.utcnow().isoformat()


def current_timestamp_with_tz() -> str:
    """Get current timestamp with timezone in ISO format."""
    return datetime.now().astimezone().isoformat()


# Validation functions
def validate_email(email: str) -> bool:
    """Validate email format."""
    if not email:
        return False
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))


def validate_phone(phone: str) -> bool:
    """Validate phone number format (basic validation)."""
    if not phone:
        return False
    
    # Remove spaces, dashes, parentheses
    cleaned_phone = re.sub(r'[\s\-\(\)]', '', phone)
    
    # Check for international format or local format
    pattern = r'^\+?[\d]{10,15}$'
    return bool(re.match(pattern, cleaned_phone))


def validate_password(password: str) -> Dict[str, Any]:
    """Validate password strength and return detailed feedback."""
    validation = {
        "is_valid": False,
        "score": 0,
        "feedback": [],
        "requirements_met": {
            "min_length": False,
            "has_uppercase": False,
            "has_lowercase": False,
            "has_digit": False,
            "has_special": False
        }
    }
    
    if not password:
        validation["feedback"].append("Password is required")
        return validation
    
    # Check minimum length
    if len(password) >= 8:
        validation["requirements_met"]["min_length"] = True
        validation["score"] += 1
    else:
        validation["feedback"].append("Password must be at least 8 characters long")
    
    # Check for uppercase letter
    if re.search(r'[A-Z]', password):
        validation["requirements_met"]["has_uppercase"] = True
        validation["score"] += 1
    else:
        validation["feedback"].append("Password must contain at least one uppercase letter")
    
    # Check for lowercase letter
    if re.search(r'[a-z]', password):
        validation["requirements_met"]["has_lowercase"] = True
        validation["score"] += 1
    else:
        validation["feedback"].append("Password must contain at least one lowercase letter")
    
    # Check for digit
    if re.search(r'\d', password):
        validation["requirements_met"]["has_digit"] = True
        validation["score"] += 1
    else:
        validation["feedback"].append("Password must contain at least one number")
    
    # Check for special character
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        validation["requirements_met"]["has_special"] = True
        validation["score"] += 1
    else:
        validation["feedback"].append("Password must contain at least one special character")
    
    # Check for common weak passwords
    weak_passwords = ["password", "123456", "qwerty", "abc123", "password123"]
    if password.lower() in weak_passwords:
        validation["feedback"].append("Password is too common")
        validation["score"] = max(0, validation["score"] - 2)
    
    # Password is valid if score is 4 or 5
    validation["is_valid"] = validation["score"] >= 4
    
    return validation


def validate_coordinates(latitude: Optional[float], longitude: Optional[float]) -> bool:
    """Validate geographic coordinates."""
    if latitude is None or longitude is None:
        return True  # Optional coordinates are valid
    
    return (-90 <= latitude <= 90) and (-180 <= longitude <= 180)


def validate_image_file(file_content: bytes) -> bool:
    """Validate if file content is a valid image."""
    try:
        image = Image.open(BytesIO(file_content))
        image.verify()  # Verify it's a valid image
        return True
    except Exception as e:
        logger.warning(f"Image validation failed: {str(e)}")
        return False


# Hashing and security functions
def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt."""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{password_hash}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    try:
        salt, password_hash = hashed_password.split(':')
        return hashlib.sha256((password + salt).encode()).hexdigest() == password_hash
    except ValueError:
        return False


def generate_secure_token(length: int = 32) -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(length)


def generate_numeric_code(length: int = 6) -> str:
    """Generate a numeric code for verification."""
    return ''.join(secrets.choice('0123456789') for _ in range(length))


# Image processing functions
def compress_image(image_content: bytes, max_width: int = 1920, max_height: int = 1080, 
                  quality: int = 85, format: str = 'JPEG') -> bytes:
    """Compress and resize image."""
    try:
        # Open image
        image = Image.open(BytesIO(image_content))
        
        # Convert to RGB if necessary (for JPEG)
        if format == 'JPEG' and image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        
        # Calculate new dimensions
        width, height = image.size
        if width > max_width or height > max_height:
            # Calculate scaling factor
            width_ratio = max_width / width
            height_ratio = max_height / height
            scale_ratio = min(width_ratio, height_ratio)
            
            new_width = int(width * scale_ratio)
            new_height = int(height * scale_ratio)
            
            # Resize image
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Save compressed image
        output_buffer = BytesIO()
        
        if format == 'PNG':
            image.save(output_buffer, format='PNG', optimize=True)
        else:
            image.save(output_buffer, format='JPEG', quality=quality, optimize=True)
        
        compressed_content = output_buffer.getvalue()
        
        logger.info(f"Image compressed: {len(image_content)} -> {len(compressed_content)} bytes "
                   f"({len(compressed_content)/len(image_content)*100:.1f}%)")
        
        return compressed_content
        
    except Exception as e:
        logger.error(f"Image compression failed: {str(e)}")
        raise


def get_image_info(image_content: bytes) -> Dict[str, Any]:
    """Get information about an image."""
    try:
        image = Image.open(BytesIO(image_content))
        
        return {
            "width": image.width,
            "height": image.height,
            "format": image.format,
            "mode": image.mode,
            "size_bytes": len(image_content),
            "aspect_ratio": round(image.width / image.height, 2) if image.height > 0 else 0
        }
    except Exception as e:
        logger.error(f"Failed to get image info: {str(e)}")
        return {}


# Text processing functions
def sanitize_text(text: str, max_length: Optional[int] = None) -> str:
    """Sanitize text input by removing harmful characters."""
    if not text:
        return ""
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Truncate if necessary
    if max_length and len(text) > max_length:
        text = text[:max_length].strip()
    
    return text


def extract_keywords(text: str, max_keywords: int = 10) -> List[str]:
    """Extract keywords from text."""
    if not text:
        return []
    
    # Convert to lowercase and remove punctuation
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    
    # Remove common stop words
    stop_words = {
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
        'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    }
    
    keywords = [word for word in words if word not in stop_words]
    
    # Count frequency and return most common
    from collections import Counter
    word_counts = Counter(keywords)
    
    return [word for word, count in word_counts.most_common(max_keywords)]


def format_phone_number(phone: str, country_code: str = '+1') -> str:
    """Format phone number to standard format."""
    if not phone:
        return ""
    
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone)
    
    if len(digits) == 10:  # US format without country code
        return f"{country_code}({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':  # US format with country code
        return f"+1({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    else:
        return phone  # Return as-is if format not recognized


# Date and time functions
def format_relative_time(timestamp: Union[str, datetime]) -> str:
    """Format timestamp as relative time (e.g., '2 hours ago')."""
    try:
        if isinstance(timestamp, str):
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        else:
            dt = timestamp
        
        now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
        diff = now - dt
        
        seconds = int(diff.total_seconds())
        
        if seconds < 60:
            return "just now"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif seconds < 86400:
            hours = seconds // 3600
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif seconds < 2592000:  # 30 days
            days = seconds // 86400
            return f"{days} day{'s' if days != 1 else ''} ago"
        elif seconds < 31536000:  # 365 days
            months = seconds // 2592000
            return f"{months} month{'s' if months != 1 else ''} ago"
        else:
            years = seconds // 31536000
            return f"{years} year{'s' if years != 1 else ''} ago"
            
    except Exception as e:
        logger.error(f"Failed to format relative time: {str(e)}")
        return "unknown"


def add_business_days(start_date: datetime, business_days: int) -> datetime:
    """Add business days to a date (excluding weekends)."""
    current_date = start_date
    days_added = 0
    
    while days_added < business_days:
        current_date += timedelta(days=1)
        # Monday = 0, Sunday = 6
        if current_date.weekday() < 5:  # Monday to Friday
            days_added += 1
    
    return current_date


def calculate_business_days_between(start_date: datetime, end_date: datetime) -> int:
    """Calculate number of business days between two dates."""
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    
    business_days = 0
    current_date = start_date
    
    while current_date < end_date:
        if current_date.weekday() < 5:  # Monday to Friday
            business_days += 1
        current_date += timedelta(days=1)
    
    return business_days


# File and path functions
def get_file_extension(filename: str) -> str:
    """Get file extension from filename."""
    if not filename:
        return ""
    return os.path.splitext(filename)[1].lower()


def generate_unique_filename(original_filename: str, user_id: str = None) -> str:
    """Generate unique filename while preserving extension."""
    if not original_filename:
        return generate_uuid()
    
    name, ext = os.path.splitext(original_filename)
    unique_id = generate_uuid()
    
    if user_id:
        return f"{user_id}_{unique_id}{ext}"
    else:
        return f"{unique_id}{ext}"


def get_mime_type(filename: str) -> str:
    """Get MIME type from filename."""
    import mimetypes
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or 'application/octet-stream'


def is_safe_filename(filename: str) -> bool:
    """Check if filename is safe (no path traversal, etc.)."""
    if not filename:
        return False
    
    # Check for path traversal attempts
    if '..' in filename or '/' in filename or '\\' in filename:
        return False
    
    # Check for reserved characters
    reserved_chars = '<>:"|?*'
    if any(char in filename for char in reserved_chars):
        return False
    
    # Check length
    if len(filename) > 255:
        return False
    
    return True


# Pagination helpers
def calculate_pagination(page: int, per_page: int, total: int) -> Dict[str, Any]:
    """Calculate pagination metadata."""
    total_pages = max(1, (total + per_page - 1) // per_page)  # Ceiling division
    
    return {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
        "has_prev": page > 1,
        "has_next": page < total_pages,
        "prev_page": page - 1 if page > 1 else None,
        "next_page": page + 1 if page < total_pages else None
    }


def get_pagination_range(current_page: int, total_pages: int, max_pages: int = 5) -> List[int]:
    """Get range of page numbers for pagination UI."""
    if total_pages <= max_pages:
        return list(range(1, total_pages + 1))
    
    # Calculate start and end pages
    half_max = max_pages // 2
    
    if current_page <= half_max:
        return list(range(1, max_pages + 1))
    elif current_page >= total_pages - half_max:
        return list(range(total_pages - max_pages + 1, total_pages + 1))
    else:
        return list(range(current_page - half_max, current_page + half_max + 1))


# Distance calculation functions
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula (in km)."""
    import math
    
    # Convert latitude and longitude from degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r


def format_distance(distance_km: float) -> str:
    """Format distance in human-readable format."""
    if distance_km < 1:
        meters = int(distance_km * 1000)
        return f"{meters} m"
    elif distance_km < 100:
        return f"{distance_km:.1f} km"
    else:
        return f"{int(distance_km)} km"


# Utility functions for API responses
def create_error_response(message: str, code: str = None, details: Any = None) -> Dict[str, Any]:
    """Create standardized error response."""
    response = {
        "success": False,
        "error": {
            "message": message,
            "timestamp": current_timestamp()
        }
    }
    
    if code:
        response["error"]["code"] = code
    
    if details:
        response["error"]["details"] = details
    
    return response


def create_success_response(data: Any = None, message: str = None, 
                           metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """Create standardized success response."""
    response = {
        "success": True,
        "timestamp": current_timestamp()
    }
    
    if data is not None:
        response["data"] = data
    
    if message:
        response["message"] = message
    
    if metadata:
        response["metadata"] = metadata
    
    return response


# Configuration helpers
def get_env_var(var_name: str, default: Any = None, required: bool = False) -> Any:
    """Get environment variable with optional default and validation."""
    value = os.environ.get(var_name, default)
    
    if required and value is None:
        raise ValueError(f"Required environment variable {var_name} is not set")
    
    return value


def parse_bool(value: Any) -> bool:
    """Parse boolean value from string or other types."""
    if isinstance(value, bool):
        return value
    
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on', 'enabled')
    
    return bool(value)