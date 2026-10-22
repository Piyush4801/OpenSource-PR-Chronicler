import asyncio
import smtplib
from email.message import EmailMessage
from typing import List, Optional, Tuple
from backend.app.config import settings
from backend.app.logger import logger
from backend.app.schemas import PRReflection

def build_plain_text_email(
    repo_name: str,
    pr_number: int,
    pr_title: str,
    pr_author: str,
    pr_url: str,
    merged_at: Optional[str],
    reflection: PRReflection
) -> str:
    learnings_text = "\n".join([f"  {idx+1}. {item}" for idx, item in enumerate(reflection.key_learnings)])
    
    return f"""=======================================================
OPEN-SOURCE PR CHRONICLER: ENGINEERING REFLECTION
=======================================================

Repository:   {repo_name}
Pull Request: #{pr_number} - {pr_title}
Author:       @{pr_author}
Merged At:    {merged_at or 'Recently'}
PR Link:      {pr_url}

-------------------------------------------------------
1. ISSUE DETAILS
-------------------------------------------------------
{reflection.issue_details}

-------------------------------------------------------
2. EXECUTION SUMMARY
-------------------------------------------------------
{reflection.execution_summary}

-------------------------------------------------------
3. KEY LEARNINGS
-------------------------------------------------------
{learnings_text}

-------------------------------------------------------
Chronicled automatically by OpenSource PR Chronicler
View PR: {pr_url}
"""

def build_html_email(
    repo_name: str,
    pr_number: int,
    pr_title: str,
    pr_author: str,
    pr_url: str,
    merged_at: Optional[str],
    reflection: PRReflection
) -> str:
    learnings_html = "".join([
        f'<li style="margin-bottom: 8px; color: #1e293b; line-height: 1.6;">{item}</li>'
        for item in reflection.key_learnings
    ])

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[OS-Log] PR Merged: {repo_name} (#{pr_number})</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; color: #ffffff;">
      <div style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 4px 10px; border-radius: 9999px; border: 1px solid rgba(96, 165, 250, 0.3); margin-bottom: 12px;">
        Open-Source PR Chronicler
      </div>
      <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #f8fafc; line-height: 1.3;">
        PR Merged: {repo_name} <span style="color: #94a3b8; font-weight: 400;">(#{pr_number})</span>
      </h1>
      <p style="font-size: 14px; margin: 0; color: #94a3b8;">
        {pr_title}
      </p>
    </div>

    <!-- Metadata Pill Bar -->
    <div style="background: #f1f5f9; padding: 14px 32px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569;">
      <span style="margin-right: 18px;"><strong>Author:</strong> @{pr_author}</span>
      <span style="margin-right: 18px;"><strong>Merged:</strong> {merged_at[:10] if merged_at else 'Recent'}</span>
      <span><a href="{pr_url}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">View on GitHub &rarr;</a></span>
    </div>

    <!-- Body Sections -->
    <div style="padding: 32px;">
      
      <!-- Section 1: Issue Details -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-right: 8px;">01</span>
          <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.04em;">Issue Details &amp; Root Cause</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #334155;">
          {reflection.issue_details}
        </div>
      </div>

      <!-- Section 2: Execution Summary -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-right: 8px;">02</span>
          <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.04em;">Execution Summary &amp; Implementation</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #334155;">
          {reflection.execution_summary}
        </div>
      </div>

      <!-- Section 3: Key Learnings -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-right: 8px;">03</span>
          <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.04em;">Key Engineering Takeaways</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
            {learnings_html}
          </ul>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <a href="{pr_url}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 600;">
          Inspect Pull Request on GitHub
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 32px; font-size: 12px; color: #64748b; text-align: center;">
      Dispatched automatically by OpenSource PR Chronicler. Ready for interview preparation and portfolio documentation.
    </div>

  </div>
</body>
</html>
"""

def _send_smtp_sync(
    subject: str,
    plain_text: str,
    html_content: str,
    recipient: str
) -> Tuple[bool, Optional[str]]:
    """
    Synchronous SMTP sending logic, designed to run in a dedicated background worker thread.
    """
    smtp_email = (settings.smtp_email or "").strip()
    smtp_password = (settings.smtp_app_password or "").replace(" ", "").strip()
    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port

    if not smtp_email or not smtp_password or not recipient:
        err = "SMTP configuration incomplete (SMTP_EMAIL, SMTP_APP_PASSWORD, or RECIPIENT_EMAIL not set)"
        logger.warning(err)
        return False, err

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_email
    msg["To"] = recipient

    # Multipart: plain-text fallback + HTML
    msg.set_content(plain_text)
    msg.add_alternative(html_content, subtype="html")

    server = None
    try:
        logger.info(f"Connecting to SMTP server {smtp_host}:{smtp_port} for recipient: {recipient}")
        
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20.0)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=20.0)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_email, smtp_password)
        server.send_message(msg)
        logger.info(f"SMTP delivery SUCCEEDED to {recipient} with subject '{subject}'")
        return True, None

    except smtplib.SMTPAuthenticationError as auth_err:
        err = f"SMTP Authentication failed: {auth_err}"
        logger.error(err)
        return False, err
    except smtplib.SMTPException as smtp_err:
        err = f"SMTP error occurred: {smtp_err}"
        logger.error(err)
        return False, err
    except Exception as e:
        err = f"Unexpected error during email delivery: {e}"
        logger.error(err)
        return False, err
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass

async def send_reflection_email(
    repo_name: str,
    pr_number: int,
    pr_title: str,
    pr_author: str,
    pr_url: str,
    merged_at: Optional[str],
    reflection: PRReflection,
    target_recipient: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Sends the reflection email asynchronously via an isolated worker thread.
    """
    recipient = target_recipient or settings.recipient_email
    subject = f"[OS-Log] PR Merged: {repo_name} (#{pr_number})"

    if not settings.smtp_email or not settings.smtp_app_password or not recipient:
        logger.warning(
            f"SMTP not fully configured. Email dispatch skipped for PR #{pr_number}. "
            f"(configured: host={settings.smtp_host}, email={bool(settings.smtp_email)}, "
            f"password={bool(settings.smtp_app_password)}, recipient={bool(recipient)})"
        )
        return False, "SMTP credentials or recipient email not configured in environment"

    plain_text = build_plain_text_email(
        repo_name=repo_name,
        pr_number=pr_number,
        pr_title=pr_title,
        pr_author=pr_author,
        pr_url=pr_url,
        merged_at=merged_at,
        reflection=reflection
    )

    html_content = build_html_email(
        repo_name=repo_name,
        pr_number=pr_number,
        pr_title=pr_title,
        pr_author=pr_author,
        pr_url=pr_url,
        merged_at=merged_at,
        reflection=reflection
    )

    # Run blocking SMTP in thread pool
    success, error = await asyncio.to_thread(
        _send_smtp_sync,
        subject=subject,
        plain_text=plain_text,
        html_content=html_content,
        recipient=recipient
    )

    return success, error
