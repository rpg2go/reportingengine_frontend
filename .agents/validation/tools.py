import os
import sys
import subprocess

def run_angular_build() -> dict:
    """Executes the Angular production build ('npm run build') to verify there are no compilation errors.

    Returns:
        dict: A dictionary containing the status of the build ('success' or 'failed'),
              the return code, and the raw stdout/stderr output.
    """
    frontend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    # Detect Windows vs Linux
    npm_cmd = "npm.cmd" if sys.platform.startswith("win") else "npm"
    
    try:
        print("Executing Angular build (npm run build)...")
        result = subprocess.run(
            [npm_cmd, "run", "build"],
            cwd=frontend_root,
            capture_output=True,
            text=True,
            timeout=300
        )
        status = "success" if result.returncode == 0 else "failed"
        return {
            "status": status,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "error": "Angular build execution timed out after 300 seconds."
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e)
        }

def audit_ui_components() -> dict:
    """Audits the Angular TypeScript components, HTML templates, and CSS files in the workspace for UI/UX guidelines and accessibility compliance.

    Returns:
        dict: A dictionary containing 'status' and a list of identified 'issues'.
    """
    frontend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    # Use git to find modified files, or fall back to listing src/app
    try:
        git_diff = subprocess.run(
            ["git", "diff", "--name-only"],
            cwd=frontend_root,
            capture_output=True,
            text=True,
            check=True
        )
        modified_files = [
            os.path.join(frontend_root, f.strip())
            for f in git_diff.stdout.splitlines()
            if f.strip().endswith((".ts", ".html", ".css"))
        ]
    except Exception as e:
        modified_files = []
        src_dir = os.path.join(frontend_root, "src", "app")
        if os.path.exists(src_dir):
            for root, _, files in os.walk(src_dir):
                for file in files:
                    if file.endswith((".ts", ".html", ".css")):
                        modified_files.append(os.path.join(root, file))

    issues = []
    for file_path in modified_files:
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            relative_path = os.path.relpath(file_path, frontend_root)
            file_ext = os.path.splitext(file_path)[1]
            
            for idx, line in enumerate(lines):
                line_num = idx + 1
                stripped = line.strip()
                
                # Check 1: Inline styles in HTML or TS components
                if file_ext == ".html" or file_ext == ".ts":
                    if 'style="' in stripped or "style: '" in stripped:
                        issues.append({
                            "file": relative_path,
                            "line": line_num,
                            "severity": "medium",
                            "type": "INLINE_STYLE_WARNING",
                            "message": "Avoid inline styles. Use css classes for slate-dark theme styling."
                        })
                
                # Check 2: Accessibility warnings on buttons or inputs
                if file_ext == ".html" or (file_ext == ".ts" and "template: `" in line):
                    if ("<button" in stripped or "<input" in stripped or "<select" in stripped) and "id=" not in stripped:
                        issues.append({
                            "file": relative_path,
                            "line": line_num,
                            "severity": "low",
                            "type": "MISSING_ELEMENT_ID",
                            "message": "Interactive elements should have unique, descriptive IDs for automated browser testing."
                        })
                    
                    if "<input" in stripped and "aria-label=" not in stripped and "placeholder=" not in stripped:
                        issues.append({
                            "file": relative_path,
                            "line": line_num,
                            "severity": "medium",
                            "type": "MISSING_ARIA_LABEL",
                            "message": "Input element lacks aria-label or placeholder, which reduces accessibility compliance."
                        })

                # Check 3: Theme alignment checking
                if file_ext == ".css" or file_ext == ".ts":
                    # Check for direct usage of bright/generic colors
                    if "#fff" in stripped.lower() or "#ffffff" in stripped.lower() or "color: white" in stripped.lower():
                        if "variables.css" not in relative_path:
                            issues.append({
                                "file": relative_path,
                                "line": line_num,
                                "severity": "low",
                                "type": "HARDCODED_THEME_COLOR",
                                "message": "Avoid hardcoded white color; use theme tokens (e.g. var(--text-color)) for theme uniformity."
                            })
        except Exception as e:
            issues.append({
                "file": os.path.basename(file_path),
                "line": 0,
                "severity": "low",
                "type": "FILE_READ_ERROR",
                "message": f"Could not audit file: {str(e)}"
            })

    return {
        "status": "success",
        "issues_found": len(issues),
        "issues": issues
    }
