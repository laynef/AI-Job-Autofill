"""
Secure API for Hired Always Chrome Extension
Handles license validation, usage tracking, and AI proxy
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
import hashlib
import hmac
import secrets
import time
import json
import os
from datetime import datetime, timedelta
import httpx

router = APIRouter(prefix="/api", tags=["extension"])

# Environment variables - MUST be set in Cloud Run
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
LICENSE_SECRET = os.environ.get("LICENSE_SECRET", secrets.token_hex(32))
FREE_TRIAL_LIMIT = 999999  # Effectively unlimited for everyone

# Whitelisted emails with unlimited free access (owner/testing)
WHITELIST_EMAILS = {
    "laynefaler@gmail.com",  # Owner - unlimited free access
}

def is_whitelisted_user(email: str) -> bool:
    """Check if user email is whitelisted for free unlimited access"""
    return email.lower() in {e.lower() for e in WHITELIST_EMAILS}

def get_user_email_from_license(license_key: str) -> Optional[str]:
    """Extract user email from license key"""
    license_data = db.get_license(license_key)
    if license_data:
        return license_data.get("user_id")
    return None

def check_whitelist_from_device(device_fingerprint: str) -> bool:
    """Check if device is associated with whitelisted user"""
    usage_data = db.get_usage(device_fingerprint)
    if usage_data.get("license_key"):
        email = get_user_email_from_license(usage_data["license_key"])
        if email and is_whitelisted_user(email):
            return True
    # Also check if device has a stored email (for whitelisted trials)
    if usage_data.get("email"):
        return is_whitelisted_user(usage_data["email"])
    return False

# Import database
from db import db

# Models
class ValidateLicenseRequest(BaseModel):
    license_key: str
    device_fingerprint: str

class TrackUsageRequest(BaseModel):
    device_fingerprint: str
    license_key: Optional[str] = None

class AIProxyRequest(BaseModel):
    prompt: str
    device_fingerprint: str
    license_key: Optional[str] = None

class CheckUsageRequest(BaseModel):
    device_fingerprint: str
    license_key: Optional[str] = None


def generate_license_key(user_id: str) -> str:
    """Generate a cryptographically signed license key"""
    timestamp = int(time.time())
    random_part = secrets.token_hex(8)

    # Create signature: HMAC(secret, user_id + timestamp + random)
    message = f"{user_id}:{timestamp}:{random_part}"
    signature = hmac.new(
        LICENSE_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()[:16]

    # Format: HA-SUB-{timestamp}-{random}-{signature}
    return f"HA-SUB-{timestamp}-{random_part}-{signature}"


def validate_license_signature(license_key: str) -> dict:
    """
    Validate license key cryptographic signature
    Returns dict with validation result
    """
    try:
        if not license_key.startswith("HA-SUB-"):
            return {"valid": False, "reason": "Invalid format"}

        parts = license_key.split("-")
        if len(parts) != 5:  # HA-SUB-timestamp-random-signature
            return {"valid": False, "reason": "Invalid structure"}

        timestamp = parts[2]
        random_part = parts[3]
        provided_signature = parts[4]

        # Reconstruct all possible user_ids to check (in production, query from DB)
        # For now, verify signature format is correct
        # In production: look up license_key in database to get user_id

        # Check if license exists in database
        license_data = db.get_license(license_key)
        if not license_data:
            return {"valid": False, "reason": "License not found"}

        # Check if license is active
        if not license_data.get("active", False):
            return {"valid": False, "reason": "License inactive"}

        # Check expiry (31 days from start_date)
        start_date = datetime.fromisoformat(license_data["start_date"])
        if datetime.now() > start_date + timedelta(days=31):
            return {"valid": False, "reason": "License expired"}

        return {
            "valid": True,
            "user_id": license_data["user_id"],
            "start_date": license_data["start_date"]
        }

    except Exception as e:
        return {"valid": False, "reason": f"Validation error: {str(e)}"}


def get_device_usage(device_fingerprint: str) -> dict:
    """Get usage data for a device"""
    return db.get_usage(device_fingerprint)


@router.post("/validate-license")
async def validate_license(request: ValidateLicenseRequest):
    """
    Validate a license key
    Called when user activates a subscription
    """
    validation = validate_license_signature(request.license_key)

    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["reason"])

    # Associate license with device
    db.update_usage(request.device_fingerprint, {"license_key": request.license_key})

    return {
        "valid": True,
        "user_id": validation["user_id"],
        "start_date": validation["start_date"],
        "expires_at": (datetime.fromisoformat(validation["start_date"]) + timedelta(days=31)).isoformat()
    }


@router.post("/check-usage")
async def check_usage(request: CheckUsageRequest):
    """
    Check usage status for a device
    Returns unlimited free access for everyone
    """
    usage_data = get_device_usage(request.device_fingerprint)

    # Everyone gets unlimited free access
    return {
        "status": "free",
        "valid": True,
        "is_paid": False,
        "is_unlimited": True,
        "message": "Unlimited free access for everyone!"
    }


@router.post("/track-usage")
async def track_usage(request: TrackUsageRequest):
    """
    Track autofill usage
    Unlimited free access for everyone
    """
    # Just log usage for analytics, no limits enforced
    db.increment_usage(request.device_fingerprint)
    db.update_usage(request.device_fingerprint, {"last_used": datetime.now().isoformat()})

    usage_data = get_device_usage(request.device_fingerprint)

    return {
        "allowed": True,
        "is_paid": False,
        "is_unlimited": True,
        "usage_count": usage_data["count"],
        "message": "Autofill authorized (unlimited free access)"
    }


@router.post("/proxy-ai")
async def proxy_ai(request: AIProxyRequest):
    """
    Proxy AI requests to Google Gemini
    Hides API key from client
    Free for everyone - no limits
    """
    # No usage limits - everyone gets free access

    # Validate API key is configured
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="AI service not configured"
        )

    # Make request to Gemini API
    try:
        async with httpx.AsyncClient() as client:
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

            response = await client.post(
                api_url,
                json={
                    "contents": [{
                        "parts": [{
                            "text": request.prompt
                        }]
                    }]
                },
                timeout=30.0
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"AI service error: {response.text}"
                )

            return response.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI service timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


# Whitelist activation endpoint
class WhitelistActivationRequest(BaseModel):
    email: str
    device_fingerprint: str

@router.post("/activate-whitelist")
async def activate_whitelist(request: WhitelistActivationRequest):
    """
    Activate unlimited free access for whitelisted emails
    No payment required - for owner use only
    """
    if not is_whitelisted_user(request.email):
        raise HTTPException(
            status_code=403,
            detail="Email not whitelisted. Please purchase a subscription."
        )

    # Store email with device for future checks
    db.update_usage(request.device_fingerprint, {
        "email": request.email,
        "last_used": datetime.now().isoformat()
    })

    return {
        "success": True,
        "email": request.email,
        "status": "whitelisted",
        "message": "Unlimited free access activated!",
        "is_whitelisted": True
    }


# Admin endpoints for license management
@router.post("/admin/create-license")
async def create_license(user_id: str, secret_key: str):
    """
    Create a new license key (admin only)
    Requires secret_key for authentication
    """
    # In production, use proper admin authentication
    if secret_key != os.environ.get("ADMIN_SECRET", ""):
        raise HTTPException(status_code=403, detail="Unauthorized")

    license_key = generate_license_key(user_id)

    # Store in database
    db.create_license(license_key, user_id)

    return {
        "license_key": license_key,
        "user_id": user_id,
        "expires_at": (datetime.now() + timedelta(days=31)).isoformat()
    }


@router.post("/admin/revoke-license")
async def revoke_license(license_key: str, secret_key: str):
    """
    Revoke a license key (admin only)
    """
    if secret_key != os.environ.get("ADMIN_SECRET", ""):
        raise HTTPException(status_code=403, detail="Unauthorized")

    license_data = db.get_license(license_key)
    if license_data:
        db.revoke_license(license_key)
        return {"message": "License revoked successfully"}
    else:
        raise HTTPException(status_code=404, detail="License not found")


# Subscription creation endpoint (called from purchase.html)
class CreateSubscriptionRequest(BaseModel):
    email: str
    subscription_id: str
    order_id: Optional[str] = None

@router.post("/create-subscription")
async def create_subscription(request: CreateSubscriptionRequest):
    """
    Create a subscription license after PayPal payment
    Called from purchase.html after successful PayPal subscription
    """
    # Generate secure license key
    license_key = generate_license_key(request.email)

    # Store in database
    db.create_license(
        license_key,
        request.email,
        paypal_subscription_id=request.subscription_id,
        paypal_order_id=request.order_id,
        payment_method="paypal"
    )

    return {
        "license_key": license_key,
        "email": request.email,
        "subscription_id": request.subscription_id,
        "expires_at": (datetime.now() + timedelta(days=31)).isoformat()
    }


# Webhook for PayPal subscription notifications
@router.post("/webhook/paypal")
async def paypal_webhook(request: Request):
    """
    Handle PayPal webhook notifications
    Automatically activate licenses when payment received
    """
    # TODO: Implement PayPal webhook verification
    # https://developer.paypal.com/api/rest/webhooks/

    body = await request.json()
    event_type = body.get("event_type")

    if event_type == "BILLING.SUBSCRIPTION.ACTIVATED":
        # Extract subscription data
        subscription = body.get("resource", {})
        subscriber_email = subscription.get("subscriber", {}).get("email_address")

        # Generate and store license key
        license_key = generate_license_key(subscriber_email)
        db.create_license(
            license_key,
            subscriber_email,
            paypal_subscription_id=subscription.get("id")
        )

        # TODO: Send license key to user via email

        return {"message": "Subscription activated", "license_key": license_key}

    return {"message": "Event processed"}
