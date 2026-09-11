#!/usr/bin/env python3
"""
Automated Anti-Sabotage Merge Engine for Community Quiz Contributions
Validates, sanitizes, consensus-checks, and merges community study answers.
"""

import json
import hashlib
import os
import re
import sys
from datetime import datetime, timezone

def clean_text(text: str) -> str:
    """Strip dangerous characters, excessive whitespace, and HTML tags."""
    if not isinstance(text, str):
        return ""
    # Strip HTML tags
    clean = re.sub(r'<[^>]*>', ' ', text)
    # Strip dangerous protocols
    clean = re.sub(r'(javascript|data|vbscript):', '', clean, flags=re.IGNORECASE)
    # Normalize whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def normalize_question_key(text: str) -> str:
    """Normalize question text for deduplication and comparison."""
    clean = clean_text(text).lower()
    # Strip punctuation and numbers for fuzzy keying
    clean = re.sub(r'[^a-z0-9]', '', clean)
    return clean

def evidence_type(payload: dict, item: dict) -> str:
    """Classify evidence without treating a community report as teacher proof."""
    value = item.get("evidenceType") or payload.get("evidenceType") or "community_report"
    return value if value in {"moodle_review", "community_report"} else "community_report"

def contributor_hash(payload: dict, item: dict, question_key: str) -> str:
    """Create an opaque per-question contributor key for duplicate suppression."""
    contributor = str(payload.get("contributorId") or payload.get("contributionId") or "legacy")
    return hashlib.sha256(f"{contributor}:{question_key}".encode("utf-8")).hexdigest()

def contributor_profile_key(payload: dict) -> str:
    """Store only a one-way contributor profile key, never the client token."""
    contributor = str(payload.get("contributorId") or payload.get("contributionId") or "legacy")
    return hashlib.sha256(f"profile:{contributor}".encode("utf-8")).hexdigest()

def extract_json_payload(raw_content: str) -> dict:
    """Extract JSON payload from raw text or markdown code blocks."""
    # Try finding markdown code block ```json ... ```
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_content)
    if match:
        raw_content = match.group(1).strip()

    # Find matching outermost braces { ... } or [ ... ]
    start_brace = raw_content.find('{')
    if start_brace != -1:
        end_brace = raw_content.rfind('}')
        if end_brace > start_brace:
            raw_content = raw_content[start_brace:end_brace + 1]

    return json.loads(raw_content)

def validate_and_merge(payload: dict, data_dir: str = "data") -> dict:
    """
    Validates input against anti-sabotage rules and merges into database.
    Returns status summary dictionary.
    """
    subject_code = payload.get("subjectCode") or payload.get("subject") or payload.get("code")
    if not subject_code or not re.match(r'^[A-Za-z0-9_-]{2,16}$', str(subject_code)):
        raise ValueError(f"Invalid subject code: '{subject_code}'. Must be 2-16 alphanumeric characters.")

    subject_code = str(subject_code).upper()
    incoming_questions = payload.get("questions")
    if not isinstance(incoming_questions, list) or len(incoming_questions) == 0:
        raise ValueError("Payload must contain a non-empty list of 'questions'.")

    os.makedirs(data_dir, exist_ok=True)
    target_file = os.path.join(data_dir, f"{subject_code}.json")

    existing_data = {
        "subjectCode": subject_code,
        "subjectName": payload.get("subjectName", subject_code),
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totalQuestions": 0,
        "questions": [],
        "contributorProfiles": {}
    }

    if os.path.exists(target_file):
        try:
            with open(target_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict) and "questions" in loaded:
                    existing_data = loaded
        except Exception as e:
            print(f"Warning reading {target_file}: {e}")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    contributor_profile = contributor_profile_key(payload)
    profiles = existing_data.setdefault("contributorProfiles", {})
    profile = profiles.setdefault(contributor_profile, {
        "accepted": 0,
        "reviewEvidence": 0,
        "communityReports": 0,
        "conflicts": 0,
        "duplicateSubmissions": 0,
        "confidence": 50
    })

    # Build lookup map of existing questions by normalized key
    existing_map = {}
    for idx, q in enumerate(existing_data.get("questions", [])):
        q_text = q.get("question") or q.get("qText") or ""
        key = normalize_question_key(q_text)
        if key:
            existing_map[key] = idx

    merged_count = 0
    updated_count = 0
    rejected_count = 0
    conflict_count = 0

    for item in incoming_questions:
        if not isinstance(item, dict):
            rejected_count += 1
            continue

        raw_q = item.get("question") or item.get("qText") or ""
        raw_a = item.get("answer") or item.get("correctAnswer") or ""
        choices = item.get("choices") or []

        clean_q = clean_text(raw_q)
        clean_a = clean_text(raw_a)

        # Anti-Sabotage Validation Checks:
        if len(clean_q) < 5 or len(clean_q) > 2000:
            rejected_count += 1
            continue

        if len(clean_a) < 1 or len(clean_a) > 500:
            rejected_count += 1
            continue

        # Reject HTML script injection attempts
        if any(bad in raw_q.lower() or bad in raw_a.lower() for bad in ["<script", "javascript:", "onload=", "onerror="]):
            rejected_count += 1
            continue

        norm_key = normalize_question_key(clean_q)
        if not norm_key:
            rejected_count += 1
            continue

        sanitized_choices = [clean_text(c) for c in choices if clean_text(c)]
        item_evidence = evidence_type(payload, item)
        contributor_key = contributor_hash(payload, item, norm_key)
        contribution_id = clean_text(str(payload.get("contributionId") or "legacy"))

        if norm_key in existing_map:
            idx = existing_map[norm_key]
            existing_item = existing_data["questions"][idx]
            curr_answer = clean_text(existing_item.get("answer", ""))
            contributor_keys = existing_item.setdefault("contributorHashes", [])
            duplicate = contributor_key in contributor_keys
            if duplicate:
                profile["duplicateSubmissions"] += 1
            if not duplicate:
                contributor_keys.append(contributor_key)
            if contribution_id and contribution_id not in existing_item.setdefault("contributionIds", []):
                existing_item["contributionIds"].append(contribution_id)

            if clean_a.lower() == curr_answer.lower():
                # Confirmed existing answer
                if not duplicate:
                    existing_item["confirmations"] = existing_item.get("confirmations", 1) + 1
                    existing_item["uniqueContributors"] = existing_item.get("uniqueContributors", 1) + 1
                    if item_evidence == "moodle_review":
                        existing_item["reviewEvidence"] = existing_item.get("reviewEvidence", 0) + 1
                        profile["reviewEvidence"] += 1
                    else:
                        existing_item["communityReports"] = existing_item.get("communityReports", 0) + 1
                        profile["communityReports"] += 1
                    profile["accepted"] += 1
                existing_item["lastVerifiedAt"] = now_iso
                if item_evidence == "moodle_review":
                    existing_item["verified"] = True
                updated_count += 1
            else:
                # Conflict Detected!
                # Anti-Sabotage Rule: An existing confirmed answer (confirmations >= 2)
                # CANNOT be overwritten by a conflicting submission.
                conf_count = existing_item.get("confirmations", 1)
                if conf_count >= 2 or item_evidence != "moodle_review":
                    conflict_count += 1
                    profile["conflicts"] += 1
                    notes = existing_item.setdefault("conflictHistory", [])
                    notes.append({
                        "rejectedAnswer": clean_a,
                        "timestamp": now_iso
                    })
                else:
                    # If existing only had 1 confirmation, record alternate answer for consensus
                    existing_item.setdefault("alternateAnswers", []).append({
                        "answer": clean_a,
                        "timestamp": now_iso
                    })
                    updated_count += 1
        else:
            # New question addition. A community report is evidence, not proof.
            new_entry = {
                "question": clean_q,
                "answer": clean_a,
                "choices": sanitized_choices,
                "verified": item_evidence == "moodle_review",
                "confirmations": 1,
                "uniqueContributors": 1,
                "reviewEvidence": 1 if item_evidence == "moodle_review" else 0,
                "communityReports": 0 if item_evidence == "moodle_review" else 1,
                "evidenceType": item_evidence,
                "contributorHashes": [contributor_key],
                "contributionIds": [clean_text(str(payload.get("contributionId") or "legacy"))],
                "firstSeenAt": now_iso,
                "lastVerifiedAt": now_iso,
                "source": item_evidence
            }
            existing_data["questions"].append(new_entry)
            existing_map[norm_key] = len(existing_data["questions"]) - 1
            merged_count += 1
            profile["accepted"] += 1
            if item_evidence == "moodle_review":
                profile["reviewEvidence"] += 1
            else:
                profile["communityReports"] += 1

    # Reputation is a moderation signal, never a proof label. It is bounded so
    # one contributor cannot dominate the database through volume alone.
    profile["confidence"] = max(0, min(100, round(
        50
        + min(profile["reviewEvidence"], 20) * 2
        + min(profile["accepted"], 20) * 0.5
        - min(profile["conflicts"], 20) * 4
        - min(profile["duplicateSubmissions"], 20) * 0.25
    )))

    existing_data["updatedAt"] = now_iso
    existing_data["totalQuestions"] = len(existing_data["questions"])

    # Sort questions alphabetically for clean git diffs
    existing_data["questions"].sort(key=lambda x: x.get("question", "").lower())

    with open(target_file, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)

    update_readme_table(data_dir)

    return {
        "subjectCode": subject_code,
        "newMerged": merged_count,
        "updatedConfirmations": updated_count,
        "conflictsHandled": conflict_count,
        "rejected": rejected_count,
        "totalInFile": len(existing_data["questions"])
    }

def update_readme_table(data_dir: str = "data"):
    """Update README.md table with live question counts."""
    readme_path = "README.md"
    if not os.path.exists(readme_path):
        return

    stats = []
    if os.path.exists(data_dir):
        for fname in sorted(os.listdir(data_dir)):
            if fname.endswith(".json"):
                fpath = os.path.join(data_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        code = data.get("subjectCode", fname.replace(".json", ""))
                        title = data.get("subjectName", code)
                        count = data.get("totalQuestions", len(data.get("questions", [])))
                        stats.append((code, title, count))
                except Exception:
                    pass

    table_rows = ["| Subject Code | Course Title | Questions |", "| --- | --- | --- |"]
    for code, title, count in stats:
        table_rows.append(f"| `{code}` | {title} | **{count}** verified answers |")

    table_content = "\n".join(table_rows)

    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r'(## 📂 Available Course Databases\s*\n\n)([\s\S]*?)(\n\n##|$)'
    if re.search(pattern, content):
        new_content = re.sub(pattern, f"\\1{table_content}\\3", content)
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(new_content)

def main():
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            raw = f.read()
    else:
        raw = sys.stdin.read()

    if not raw.strip():
        print("Error: No input payload provided.", file=sys.stderr)
        sys.exit(1)

    try:
        payload = extract_json_payload(raw)
        result = validate_and_merge(payload)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
