import pytest
from unittest.mock import patch, MagicMock
from backend.app.schemas import PRReflection
from backend.app.email_service import (
    build_plain_text_email,
    build_html_email,
    _send_smtp_sync,
    send_reflection_email
)

@pytest.fixture
def sample_reflection():
    return PRReflection(
        issue_details="Root cause: Unhandled null pointer when deserializing empty payloads.",
        execution_summary="Added null-safe guard in payload_parser.ts and added fallback default.",
        key_learnings=[
            "Always defend against unexpected null values at API boundaries.",
            "Write explicit unit tests covering edge-case empty inputs.",
            "Utilize static typing to catch potential null exceptions at compile time."
        ]
    )

def test_email_template_rendering(sample_reflection):
    plain = build_plain_text_email(
        repo_name="facebook/react",
        pr_number=24000,
        pr_title="Fix hydration mismatch on empty text nodes",
        pr_author="gaearon",
        pr_url="https://github.com/facebook/react/pull/24000",
        merged_at="2026-10-22T05:00:00Z",
        reflection=sample_reflection
    )
    assert "facebook/react" in plain
    assert "#24000" in plain
    assert "Root cause: Unhandled null pointer" in plain
    assert "1. Always defend against unexpected null values" in plain

    html = build_html_email(
        repo_name="facebook/react",
        pr_number=24000,
        pr_title="Fix hydration mismatch on empty text nodes",
        pr_author="gaearon",
        pr_url="https://github.com/facebook/react/pull/24000",
        merged_at="2026-10-22T05:00:00Z",
        reflection=sample_reflection
    )
    assert "<!DOCTYPE html>" in html
    assert "facebook/react" in html
    assert "(#24000)" in html
    assert "https://github.com/facebook/react/pull/24000" in html
    assert "Issue Details" in html
    assert "Execution Summary" in html

@patch("smtplib.SMTP")
def test_send_smtp_sync_success(mock_smtp_class):
    mock_server = MagicMock()
    mock_smtp_class.return_value = mock_server

    success, error = _send_smtp_sync(
        subject="[OS-Log] PR Merged: test/repo (#1)",
        plain_text="Plain text body",
        html_content="<p>HTML</p>",
        recipient="user@example.com"
    )

    assert success is True
    assert error is None
    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_once()
    mock_server.send_message.assert_called_once()
    mock_server.quit.assert_called_once()

@patch("smtplib.SMTP")
def test_send_smtp_sync_auth_failure(mock_smtp_class):
    import smtplib
    mock_server = MagicMock()
    mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Authentication failed")
    mock_smtp_class.return_value = mock_server

    success, error = _send_smtp_sync(
        subject="[OS-Log] PR Merged: test/repo (#1)",
        plain_text="Plain text body",
        html_content="<p>HTML</p>",
        recipient="user@example.com"
    )

    assert success is False
    assert "SMTP Authentication failed" in error
