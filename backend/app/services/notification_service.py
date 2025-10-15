from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
from app.supabase_client import insert_data, get_data

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for handling notifications and communications."""
    
    @staticmethod
    def notify_issue_created(issue: Dict[str, Any], citizen: Dict[str, Any]) -> bool:
        """Notify when a new issue is created."""
        try:
            # Log notification (replace with actual notification logic)
            logger.info(f"Issue created notification: '{issue['title']}' by {citizen.get('full_name', 'Unknown')}")
            
            # Create notification record
            notification_data = {
                "user_id": citizen["id"],
                "title": "Issue Submitted Successfully",
                "message": f"Your issue '{issue['title']}' has been submitted and is under review.",
                "type": "success",
                "metadata": {
                    "issue_id": issue["id"],
                    "category": issue.get("category"),
                    "action": "issue_created"
                }
            }
            
            NotificationService._create_notification(notification_data)
            
            # Here you would typically:
            # - Send email confirmation to citizen
            # - Send push notification to mobile app
            # - Notify relevant departments/supervisors
            # - Log to external notification system
            
            # Example email notification (pseudo-code)
            # NotificationService._send_email(
            #     to=citizen.get("email"),
            #     subject="Issue Submitted Successfully",
            #     template="issue_created",
            #     data={"issue": issue, "citizen": citizen}
            # )
            
            # Notify supervisors in relevant department
            NotificationService._notify_supervisors_of_new_issue(issue)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send issue created notification: {str(e)}")
            return False
    
    @staticmethod
    def notify_issue_assigned(issue: Dict[str, Any], assignment: Dict[str, Any], 
                            staff: Dict[str, Any]) -> bool:
        """Notify when an issue is assigned to staff."""
        try:
            logger.info(f"Issue assigned notification: '{issue['title']}' assigned to {staff.get('full_name', 'Unknown')}")
            
            # Notify staff member
            staff_notification = {
                "user_id": staff["id"],
                "title": "New Issue Assigned",
                "message": f"You have been assigned to work on: {issue['title']}",
                "type": "info",
                "metadata": {
                    "issue_id": issue["id"],
                    "assignment_id": assignment.get("id"),
                    "category": issue.get("category"),
                    "action": "issue_assigned"
                }
            }
            
            NotificationService._create_notification(staff_notification)
            
            # Notify citizen about assignment
            citizen_data = get_data("profiles", {"id": issue["citizen_id"]})
            if citizen_data:
                citizen_notification = {
                    "user_id": issue["citizen_id"],
                    "title": "Issue Assigned to Staff",
                    "message": f"Your issue '{issue['title']}' has been assigned to our team for resolution.",
                    "type": "info",
                    "metadata": {
                        "issue_id": issue["id"],
                        "assignment_id": assignment.get("id"),
                        "action": "issue_assigned_citizen"
                    }
                }
                
                NotificationService._create_notification(citizen_notification)
            
            # Here you would typically:
            # - Send email to staff member with issue details
            # - Send push notification to staff mobile app
            # - Send SMS if urgent
            # - Update citizen about assignment progress
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send assignment notification: {str(e)}")
            return False
    
    @staticmethod
    def notify_issue_updated(issue: Dict[str, Any], update: Dict[str, Any], 
                           citizen: Dict[str, Any]) -> bool:
        """Notify when an issue receives an update."""
        try:
            logger.info(f"Issue update notification: '{issue['title']}' updated")
            
            # Notify citizen about the update
            citizen_notification = {
                "user_id": citizen["id"],
                "title": "Update on Your Issue",
                "message": f"There's a new update on your issue: {issue['title']}",
                "type": "info",
                "metadata": {
                    "issue_id": issue["id"],
                    "update_id": update.get("id"),
                    "staff_name": update.get("staff_name"),
                    "action": "issue_updated"
                }
            }
            
            NotificationService._create_notification(citizen_notification)
            
            # Here you would typically:
            # - Send email to citizen with update details
            # - Send push notification to citizen mobile app
            # - Send SMS if requested by citizen
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send update notification: {str(e)}")
            return False
    
    @staticmethod
    def notify_issue_resolved(issue: Dict[str, Any], citizen: Dict[str, Any]) -> bool:
        """Notify when an issue is resolved."""
        try:
            logger.info(f"Issue resolved notification: '{issue['title']}' resolved")
            
            # Notify citizen about resolution
            citizen_notification = {
                "user_id": citizen["id"],
                "title": "Issue Resolved!",
                "message": f"Great news! Your issue '{issue['title']}' has been resolved.",
                "type": "success",
                "metadata": {
                    "issue_id": issue["id"],
                    "action": "issue_resolved"
                }
            }
            
            NotificationService._create_notification(citizen_notification)
            
            # Here you would typically:
            # - Send email to citizen with resolution details
            # - Send push notification to citizen mobile app
            # - Request feedback/rating from citizen
            # - Update relevant stakeholders
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send resolution notification: {str(e)}")
            return False
    
    @staticmethod
    def notify_high_priority_issue(issue: Dict[str, Any], reason: str) -> bool:
        """Notify about high priority issues that need immediate attention."""
        try:
            logger.warning(f"High priority issue notification: '{issue['title']}' - {reason}")
            
            # Get all supervisors and admins
            supervisors = get_data("profiles", {"role": ["supervisor", "admin"]})
            
            for supervisor in supervisors:
                notification_data = {
                    "user_id": supervisor["id"],
                    "title": "High Priority Issue Alert",
                    "message": f"Urgent attention needed for issue: {issue['title']}. Reason: {reason}",
                    "type": "warning",
                    "metadata": {
                        "issue_id": issue["id"],
                        "priority_reason": reason,
                        "action": "high_priority_alert"
                    }
                }
                
                NotificationService._create_notification(notification_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send high priority notification: {str(e)}")
            return False
    
    @staticmethod
    def notify_overdue_issues(overdue_issues: List[Dict[str, Any]]) -> bool:
        """Notify about overdue issues."""
        try:
            if not overdue_issues:
                return True
            
            logger.info(f"Overdue issues notification: {len(overdue_issues)} issues overdue")
            
            # Group issues by assigned staff
            staff_issues = {}
            for issue in overdue_issues:
                assignments = get_data("issue_assignments", {"issue_id": issue["id"], "status": ["assigned", "in_progress"]})
                
                for assignment in assignments:
                    staff_id = assignment["staff_id"]
                    if staff_id not in staff_issues:
                        staff_issues[staff_id] = []
                    staff_issues[staff_id].append(issue)
            
            # Notify each staff member about their overdue issues
            for staff_id, issues in staff_issues.items():
                issue_titles = [issue["title"] for issue in issues[:3]]  # Show first 3
                more_count = len(issues) - 3 if len(issues) > 3 else 0
                
                message = f"You have {len(issues)} overdue issue(s): {', '.join(issue_titles)}"
                if more_count > 0:
                    message += f" and {more_count} more"
                
                notification_data = {
                    "user_id": staff_id,
                    "title": "Overdue Issues Alert",
                    "message": message,
                    "type": "warning",
                    "metadata": {
                        "overdue_count": len(issues),
                        "issue_ids": [issue["id"] for issue in issues],
                        "action": "overdue_issues"
                    }
                }
                
                NotificationService._create_notification(notification_data)
            
            # Notify supervisors about department overdue issues
            departments = {}
            for staff_id in staff_issues.keys():
                staff_data = get_data("profiles", {"id": staff_id})
                if staff_data and staff_data[0].get("department"):
                    dept = staff_data[0]["department"]
                    if dept not in departments:
                        departments[dept] = 0
                    departments[dept] += len(staff_issues[staff_id])
            
            for dept, count in departments.items():
                supervisors = get_data("profiles", {"role": "supervisor", "department": dept})
                
                for supervisor in supervisors:
                    notification_data = {
                        "user_id": supervisor["id"],
                        "title": "Department Overdue Issues",
                        "message": f"Your department has {count} overdue issue(s) requiring attention.",
                        "type": "warning",
                        "metadata": {
                            "department": dept,
                            "overdue_count": count,
                            "action": "department_overdue"
                        }
                    }
                    
                    NotificationService._create_notification(notification_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send overdue issues notification: {str(e)}")
            return False
    
    @staticmethod
    def _create_notification(notification_data: Dict[str, Any]) -> bool:
        """Create a notification record in the database."""
        try:
            # Add timestamp
            notification_data["created_at"] = datetime.now().isoformat()
            notification_data["is_read"] = False
            
            # If notifications table exists, insert the notification
            # For now, we'll just log it since the table might not exist
            logger.info(f"Notification created: {notification_data['title']} for user {notification_data['user_id']}")
            
            # Uncomment this if you have a notifications table:
            # result = insert_data("notifications", notification_data)
            # return bool(result)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create notification: {str(e)}")
            return False
    
    @staticmethod
    def _notify_supervisors_of_new_issue(issue: Dict[str, Any]) -> bool:
        """Notify supervisors about new issues in their area of responsibility."""
        try:
            # Get all supervisors
            supervisors = get_data("profiles", {"role": "supervisor"})
            
            for supervisor in supervisors:
                # You could implement logic to determine which supervisors should be notified
                # based on issue category, location, department, etc.
                
                notification_data = {
                    "user_id": supervisor["id"],
                    "title": "New Issue Reported",
                    "message": f"A new {issue.get('category', 'general')} issue has been reported: {issue['title']}",
                    "type": "info",
                    "metadata": {
                        "issue_id": issue["id"],
                        "category": issue.get("category"),
                        "action": "new_issue_supervisor"
                    }
                }
                
                NotificationService._create_notification(notification_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to notify supervisors: {str(e)}")
            return False
    
    @staticmethod
    def get_user_notifications(user_id: str, unread_only: bool = False, 
                              limit: int = 50) -> List[Dict[str, Any]]:
        """Get notifications for a user."""
        try:
            filters = {"user_id": user_id}
            if unread_only:
                filters["is_read"] = False
            
            # This would work if you have a notifications table
            # notifications = get_data("notifications", filters=filters, order_by="-created_at", limit=limit)
            # return notifications
            
            # For now, return empty list since notifications table doesn't exist
            logger.info(f"Fetching notifications for user {user_id}")
            return []
            
        except Exception as e:
            logger.error(f"Failed to get notifications for user {user_id}: {str(e)}")
            return []
    
    @staticmethod
    def mark_notification_read(notification_id: int, user_id: str) -> bool:
        """Mark a notification as read."""
        try:
            # This would work if you have a notifications table
            # result = update_data("notifications", 
            #                     {"id": notification_id, "user_id": user_id}, 
            #                     {"is_read": True, "read_at": datetime.now().isoformat()})
            # return bool(result)
            
            # For now, just log it
            logger.info(f"Marking notification {notification_id} as read for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to mark notification as read: {str(e)}")
            return False
    
    @staticmethod
    def send_bulk_notification(user_ids: List[str], title: str, message: str, 
                              notification_type: str = "info", metadata: Optional[Dict[str, Any]] = None) -> int:
        """Send notification to multiple users."""
        try:
            success_count = 0
            
            for user_id in user_ids:
                notification_data = {
                    "user_id": user_id,
                    "title": title,
                    "message": message,
                    "type": notification_type,
                    "metadata": metadata or {}
                }
                
                if NotificationService._create_notification(notification_data):
                    success_count += 1
            
            logger.info(f"Bulk notification sent to {success_count}/{len(user_ids)} users")
            return success_count
            
        except Exception as e:
            logger.error(f"Failed to send bulk notification: {str(e)}")
            return 0
    
    @staticmethod
    def get_notification_statistics(days: int = 30) -> Dict[str, Any]:
        """Get notification statistics for the specified period."""
        try:
            # This would work if you have a notifications table
            stats = {
                "period_days": days,
                "total_notifications": 0,
                "notifications_by_type": {
                    "info": 0,
                    "success": 0,
                    "warning": 0,
                    "error": 0
                },
                "read_rate": 0.0,
                "most_common_actions": []
            }
            
            # For now, return mock stats
            logger.info(f"Fetching notification statistics for {days} days")
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get notification statistics: {str(e)}")
            return {"error": str(e)}


# Email service integration (placeholder)
class EmailService:
    """Email service integration."""
    
    @staticmethod
    def send_email(to: str, subject: str, body: str, template: Optional[str] = None, 
                  data: Optional[Dict[str, Any]] = None) -> bool:
        """Send email notification."""
        try:
            logger.info(f"Sending email to {to}: {subject}")
            
            # Here you would integrate with your email service:
            # - SendGrid
            # - AWS SES
            # - Mailgun
            # - SMTP server
            
            # Example with SendGrid (pseudo-code):
            # import sendgrid
            # from sendgrid.helpers.mail import Mail
            # 
            # sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
            # mail = Mail(
            #     from_email='noreply@civicissues.com',
            #     to_emails=to,
            #     subject=subject,
            #     html_content=body
            # )
            # response = sg.send(mail)
            # return response.status_code == 202
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {str(e)}")
            return False


# SMS service integration (placeholder)
class SMSService:
    """SMS service integration."""
    
    @staticmethod
    def send_sms(to: str, message: str) -> bool:
        """Send SMS notification."""
        try:
            logger.info(f"Sending SMS to {to}: {message[:50]}...")
            
            # Here you would integrate with your SMS service:
            # - Twilio
            # - AWS SNS
            # - Nexmo/Vonage
            
            # Example with Twilio (pseudo-code):
            # from twilio.rest import Client
            # 
            # client = Client(account_sid, auth_token)
            # message = client.messages.create(
            #     body=message,
            #     from_='+1234567890',  # Your Twilio phone number
            #     to=to
            # )
            # return bool(message.sid)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send SMS to {to}: {str(e)}")
            return False


# Push notification service integration (placeholder)
class PushNotificationService:
    """Push notification service integration."""
    
    @staticmethod
    def send_push_notification(user_tokens: List[str], title: str, body: str, 
                              data: Optional[Dict[str, Any]] = None) -> int:
        """Send push notification to mobile devices."""
        try:
            logger.info(f"Sending push notification to {len(user_tokens)} devices: {title}")
            
            # Here you would integrate with your push notification service:
            # - Firebase Cloud Messaging (FCM)
            # - Apple Push Notification Service (APNS)
            # - AWS SNS
            
            # Example with FCM (pseudo-code):
            # import firebase_admin
            # from firebase_admin import messaging
            # 
            # message = messaging.MulticastMessage(
            #     notification=messaging.Notification(title=title, body=body),
            #     data=data or {},
            #     tokens=user_tokens
            # )
            # 
            # response = messaging.send_multicast(message)
            # return response.success_count
            
            return len(user_tokens)  # Mock success count
            
        except Exception as e:
            logger.error(f"Failed to send push notification: {str(e)}")
            return 0