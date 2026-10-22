import json
from typing import Dict, Any, List, Optional
from pydantic import ValidationError

from backend.app.config import settings
from backend.app.schemas import PRReflection
from backend.app.logger import logger

REFLECTION_SYSTEM_PROMPT = """You are a senior software architect and technical chronicler analyzing a merged GitHub Pull Request.
Your role is to produce a grounded, factual, evidence-based engineering reflection of what was accomplished, why it was needed, and key lessons.

CRITICAL INSTRUCTIONS:
1. ONLY make claims supported by the PR metadata, the linked issue descriptions, and the file diffs.
2. NEVER invent or hallucinate files, functions, or changes that do not appear in the diff.
3. If the diff or context is incomplete or truncated, explicitly state that limitation in your summary.
4. Issue Details: Explain the root cause of the bug or the rationale for the feature request, referencing the linked issue or PR description.
5. Execution Summary: Detail the specific files modified, architectural or logic changes made, and technical tradeoffs chosen.
6. Key Learnings: Provide exactly 3 or 4 high-value, specific engineering takeaways that an open-source contributor can use in interviews and technical documentation.

{format_instructions}
"""

REFLECTION_USER_PROMPT = """Analyze the following merged GitHub Pull Request:

Repository: {repo_owner}/{repo_name}
Pull Request: #{pr_number} - {pr_title}
Author: {pr_author}
PR Description:
{pr_body}

Linked Issues:
{linked_issues_summary}

Changed Files ({file_count} files):
{file_list_summary}

Diff / Patch Content (Character count: {diff_char_count}):
{diff_content}

Produce the structured reflection now adhering strictly to the required schema.
"""

def build_reflection_chain(api_key: Optional[str] = None, model_name: Optional[str] = None):
    """
    Build the LCEL chain: Prompt | ChatGoogleGenerativeAI | JsonOutputParser.
    Lazy imports guarantee instantaneous server startup and lightweight test runs.
    """
    from langchain_core.prompts.chat import ChatPromptTemplate
    from langchain_core.output_parsers.json import JsonOutputParser
    from langchain_google_genai.chat_models import ChatGoogleGenerativeAI

    key = api_key or settings.google_api_key
    model = model_name or settings.gemini_model or "gemini-1.5-flash"

    parser = JsonOutputParser(pydantic_object=PRReflection)

    llm = ChatGoogleGenerativeAI(
        model=model,
        temperature=0.1,
        google_api_key=key
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", REFLECTION_SYSTEM_PROMPT),
        ("user", REFLECTION_USER_PROMPT),
    ]).partial(format_instructions=parser.get_format_instructions())

    return prompt | llm | parser

def generate_fallback_reflection(
    repo_name: str,
    pr_number: int,
    pr_title: str,
    files: List[Dict[str, Any]],
    linked_issues: List[Dict[str, Any]],
    diff_char_count: int,
    pr_body: Optional[str] = None
) -> PRReflection:
    """
    Deterministic grounded fallback generator when GOOGLE_API_KEY is not configured,
    ensuring continuous functionality in offline or test environments.
    """
    file_names = [f.get("filename", "") for f in files] if files else ["unspecified files"]
    issue_numbers = [f"#{i.get('number')}" for i in linked_issues if i.get("number")]

    if issue_numbers:
        issue_part = f"Resolves {', '.join(issue_numbers)}: {linked_issues[0].get('title', '')}."
    elif pr_body and len(pr_body.strip()) > 10:
        issue_part = f"Requirement addressed: {pr_body.strip()[:200]}..."
    else:
        issue_part = f"Addressed issue/feature titled: '{pr_title}'. No explicit linked issue was detected in the PR description."

    files_summary = ", ".join(file_names[:4])
    if len(file_names) > 4:
        files_summary += f", and {len(file_names) - 4} other files"

    execution = (
        f"Merged changes in PR #{pr_number} modified {len(files)} file(s) ({files_summary}). "
        f"Total diff length retrieved: {diff_char_count} characters. "
        f"Implemented the requested logic adjustments adhering to repository conventions."
    )

    learnings = [
        f"Gained hands-on experience structuring commits and pull requests for {repo_name}.",
        f"Analyzed code change boundaries across {len(files)} file(s) ({files_summary}).",
        "Demonstrated the importance of end-to-end integration testing and automated reflection pipelines."
    ]

    return PRReflection(
        issue_details=issue_part,
        execution_summary=execution,
        key_learnings=learnings
    )

async def generate_pr_reflection(
    repo_owner: str,
    repo_name: str,
    pr_number: int,
    pr_title: str,
    pr_author: str,
    pr_body: Optional[str],
    pr_context: Dict[str, Any]
) -> PRReflection:
    """
    Executes the LangChain LCEL pipeline with ChatGoogleGenerativeAI and JsonOutputParser,
    validating the output with Pydantic.
    """
    files = pr_context.get("files", [])
    diff_text = pr_context.get("diff_text", "")
    diff_char_count = pr_context.get("diff_char_count", 0)
    linked_issues = pr_context.get("linked_issues", [])

    # Format linked issues summary
    if linked_issues:
        issues_text = "\n".join([
            f"- Issue #{i.get('number')}: {i.get('title')}\n  Description: {i.get('body', '')[:400]}"
            for i in linked_issues
        ])
    else:
        issues_text = "No linked issues referenced in PR description or title."

    # Format file list summary
    file_list_text = "\n".join([
        f"- {f.get('filename')} ({f.get('status')}, +{f.get('additions')}/-{f.get('deletions')})"
        for f in files[:25]
    ])
    if len(files) > 25:
        file_list_text += f"\n... and {len(files) - 25} more files."

    # Limit diff text size to avoid exceeding token windows if diff is enormous
    truncated_diff = diff_text[:25000]
    if len(diff_text) > 25000:
        truncated_diff += "\n\n[Diff truncated to 25,000 characters for token context limits]"

    # If Google API key is not configured, log clearly and use grounded fallback
    if not settings.google_api_key or settings.google_api_key.strip() == "":
        logger.warning(
            "GOOGLE_API_KEY is not configured. Utilizing grounded fallback reflection pipeline."
        )
        return generate_fallback_reflection(
            repo_name=repo_name,
            pr_number=pr_number,
            pr_title=pr_title,
            files=files,
            linked_issues=linked_issues,
            diff_char_count=diff_char_count,
            pr_body=pr_body
        )

    logger.info(f"Invoking LangChain LCEL chain with model={settings.gemini_model} for PR #{pr_number}")
    
    try:
        chain = build_reflection_chain()
        input_data = {
            "repo_owner": repo_owner,
            "repo_name": repo_name,
            "pr_number": pr_number,
            "pr_title": pr_title,
            "pr_author": pr_author,
            "pr_body": pr_body or "No description provided.",
            "linked_issues_summary": issues_text,
            "file_count": len(files),
            "file_list_summary": file_list_text,
            "diff_char_count": diff_char_count,
            "diff_content": truncated_diff or "No patch text available."
        }

        raw_output = await chain.ainvoke(input_data)
        logger.info(f"LangChain parser raw output received for PR #{pr_number}: {json.dumps(raw_output)[:200]}...")

        # Strict Pydantic validation
        validated = PRReflection.model_validate(raw_output)
        logger.info(f"Successfully validated PRReflection for PR #{pr_number}")
        return validated

    except ValidationError as ve:
        logger.error(f"Pydantic validation failed for AI output on PR #{pr_number}: {ve}")
        raise
    except Exception as e:
        logger.error(f"Error in LangChain Gemini pipeline for PR #{pr_number}: {e}")
        logger.info(f"Falling back to grounded generator for PR #{pr_number} due to AI error")
        return generate_fallback_reflection(
            repo_name=repo_name,
            pr_number=pr_number,
            pr_title=pr_title,
            files=files,
            linked_issues=linked_issues,
            diff_char_count=diff_char_count,
            pr_body=pr_body
        )
