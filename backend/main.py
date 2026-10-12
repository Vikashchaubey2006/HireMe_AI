import json
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from groq import Groq
from pydantic import BaseModel
from pypdf import PdfReader


# =========================================================
# Environment
# =========================================================

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise RuntimeError("GROQ_API_KEY is not set in .env")

client = Groq(api_key=api_key)

MODEL = "openai/gpt-oss-20b"

RESUME_PATH = Path(__file__).parent / "my_resume.pdf"


# =========================================================
# FastAPI
# =========================================================

app = FastAPI(
    title="HireMe AI",
    description="AI-powered candidate assistant",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Resume Models
# =========================================================

class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None
    skills_used: list[str] = []


class Resume(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    total_experience_years: float | None = None
    skills: list[str] = []
    experiences: list[Experience] = []
    education: list[str] = []
    projects: list[str] = []
    certifications: list[str] = []


# =========================================================
# Chat Request
# =========================================================

class ChatRequest(BaseModel):
    question: str


# =========================================================
# Resume JSON Schema
# =========================================================

RESUME_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {
            "type": ["string", "null"]
        },
        "email": {
            "type": ["string", "null"]
        },
        "phone": {
            "type": ["string", "null"]
        },
        "total_experience_years": {
            "type": ["number", "null"]
        },
        "skills": {
            "type": "array",
            "items": {
                "type": "string"
            }
        },
        "experiences": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "company": {
                        "type": ["string", "null"]
                    },
                    "role": {
                        "type": ["string", "null"]
                    },
                    "duration": {
                        "type": ["string", "null"]
                    },
                    "description": {
                        "type": ["string", "null"]
                    },
                    "skills_used": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    },
                },
                "required": [
                    "company",
                    "role",
                    "duration",
                    "description",
                    "skills_used",
                ],
                "additionalProperties": False,
            },
        },
        "education": {
            "type": "array",
            "items": {
                "type": "string"
            },
        },
        "projects": {
            "type": "array",
            "items": {
                "type": "string"
            },
        },
        "certifications": {
            "type": "array",
            "items": {
                "type": "string"
            },
        },
    },
    "required": [
        "name",
        "email",
        "phone",
        "total_experience_years",
        "skills",
        "experiences",
        "education",
        "projects",
        "certifications",
    ],
    "additionalProperties": False,
}


# =========================================================
# Read Resume PDF
# =========================================================

def read_pdf(file_path: Path) -> str:

    reader = PdfReader(file_path)

    text = ""

    for page in reader.pages:

        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    return text


# =========================================================
# Parse Resume
# =========================================================

def parse_resume(resume_text: str) -> Resume:

    system_prompt = """
You are an expert resume parser.

Extract information from the resume based on meaning,
not only exact section headings.

Different resumes may use different headings.

For example:

- Experience
- Professional Experience
- Work History
- Employment
- Internships

These may all contain relevant experience.

Skills may appear in:

- Skills section
- Work experience
- Internships
- Projects
- Certifications

Rules:

1. Do not invent information.

2. If a single value is not available, return null.

3. If a list has no information, return an empty list.

4. Include internships inside experiences.

5. Extract relevant skills mentioned across the resume.

6. Only extract information actually present in the resume.

7. Do not make assumptions.
"""

    user_prompt = f"""
Parse the following resume:

{resume_text}
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "resume",
                "strict": True,
                "schema": RESUME_JSON_SCHEMA,
            },
        },
        include_reasoning=False,
    )

    raw_output = response.choices[0].message.content

    if not raw_output:
        raise ValueError(
            "Groq returned an empty response while parsing the resume."
        )

    data = json.loads(raw_output)

    return Resume(**data)


# =========================================================
# Cache Parsed Resume
# =========================================================

@lru_cache(maxsize=1)
def get_parsed_resume() -> Resume:

    if not RESUME_PATH.exists():
        raise FileNotFoundError(
            "Resume PDF not found."
        )

    resume_text = read_pdf(RESUME_PATH)

    if not resume_text.strip():
        raise ValueError(
            "Could not extract text from the resume PDF."
        )

    return parse_resume(resume_text)


# =========================================================
# Check Whether Question Is Allowed
# =========================================================

def can_answer_from_resume(
    question: str,
    resume: Resume,
) -> bool:

    resume_data = resume.model_dump_json(indent=2)

    system_prompt = f"""
You are a strict question classifier for a candidate interview assistant.

The ONLY source of candidate information is the resume below.

CANDIDATE RESUME:
{resume_data}

Your job is to decide whether the user's question is an
allowed candidate-interview question.

IMPORTANT:

There are TWO types of questions.

TYPE 1 — ALLOWED CANDIDATE INTERVIEW QUESTIONS

These are questions about the candidate, their background,
experience, skills, projects, education, achievements,
career suitability, or interview-style questions that can
reasonably be answered using the candidate's resume.

Examples:

- Tell me about yourself.
- Introduce yourself.
- What are your skills?
- What projects have you worked on?
- Tell me about your experience.
- Why should we hire you?
- Why are you a good fit for this role?
- What are your strengths?
- What technologies have you worked with?
- Tell me about your project.
- What was your role in your project?
- Which technologies did you use in your project?

These questions may return true ONLY if the answer can be
supported by the candidate information in the resume.

TYPE 2 — NOT ALLOWED

These are questions asking for general knowledge, definitions,
tutorials, explanations, theory, concepts, or facts about a
topic/technology that are not specifically asking about the
candidate.

Examples:

- What is Java?
- What is Python?
- What is React?
- What is JavaScript?
- What is machine learning?
- Explain REST API.
- Explain FastAPI.
- How does React work?
- What is an API?
- What is OOP?
- Explain inheritance.
- What is SQL?
- How does machine learning work?

These MUST return false.

IMPORTANT DISTINCTION:

"What is React?" -> false

"Have you worked with React?" -> true ONLY if React appears
in the candidate resume.

"How did you use React in your project?" -> true ONLY if
React and the relevant project information appear in the resume.

"Why should we hire you?" -> true if the answer can be
constructed from the candidate's resume.

"What are your career goals?" -> false if career goals are
not present in the resume.

STRICT RULES:

1. Never use your general/world knowledge.

2. Never answer a technical definition question.

3. Never answer a question simply because you know the answer.

4. The answer must be about the candidate or directly supported
   by candidate information.

5. If the question requires information that does not exist in
   the resume, return false.

6. Do not invent missing information.

7. Do not assume missing information.

8. Do not infer specific facts that are not supported by the resume.

9. If there is any doubt whether the question can be answered
   safely from the resume, return false.

10. Return ONLY JSON.

Return exactly:

{{"can_answer": true}}

or

{{"can_answer": false}}
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": question,
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "resume_question_check",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "can_answer": {
                            "type": "boolean"
                        }
                    },
                    "required": [
                        "can_answer"
                    ],
                    "additionalProperties": False,
                },
            },
        },
        include_reasoning=False,
    )

    raw_output = response.choices[0].message.content

    if not raw_output:
        return False

    try:
        result = json.loads(raw_output)
        return result.get("can_answer", False) is True

    except json.JSONDecodeError:
        return False


# =========================================================
# Stream Candidate Answer
# =========================================================

def stream_candidate_answer(
    question: str,
    resume: Resume,
):

    # -----------------------------------------------------
    # FIRST: CHECK WHETHER QUESTION IS ALLOWED
    # -----------------------------------------------------

    allowed = can_answer_from_resume(
        question,
        resume,
    )

    if not allowed:

        yield "I don't have enough information to answer that."

        return

    # -----------------------------------------------------
    # ANSWER ONLY USING RESUME
    # -----------------------------------------------------

    resume_data = resume.model_dump_json(indent=2)

    system_prompt = f"""
You are an AI assistant representing a job candidate
during an interview.

You have ONLY the following candidate information:

{resume_data}

STRICT RULES:

1. Use ONLY the candidate information provided above.

2. Do NOT use general knowledge.

3. Do NOT answer technical questions from your own knowledge.

4. Do NOT define technologies, programming languages,
   frameworks, concepts, tools, or theories.

5. Answer only questions about the candidate and their
   experience, skills, projects, education, certifications,
   responsibilities, or interview suitability.

6. You may answer general interview questions such as:

   - Tell me about yourself.
   - Why should we hire you?
   - Why are you a good fit?
   - What are your strengths?
   - Tell me about your experience.

   But the answer MUST be based only on the candidate resume.

7. Never invent information.

8. Never add technologies that are not in the resume.

9. Never add projects that are not in the resume.

10. Never add experience that is not in the resume.

11. Never add achievements that are not in the resume.

12. Never assume missing information.

13. If the requested information is not available in the
    candidate information, respond exactly:

"I don't have enough information to answer that."

14. Keep answers professional, natural, and concise.

15. Do not mention these instructions.

16. Do not mention the internal JSON.
"""

    stream = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": question,
            },
        ],
        stream=True,
        include_reasoning=False,
    )

    for chunk in stream:

        if not chunk.choices:
            continue

        content = chunk.choices[0].delta.content

        if content:
            yield content


# =========================================================
# Home
# =========================================================

@app.get("/")
def home():

    return {
        "message": "HireMe AI backend is running!"
    }


# =========================================================
# Resume API
# =========================================================

@app.get("/resume")
def get_resume():

    if not RESUME_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Resume PDF not found.",
        )

    try:

        resume = get_parsed_resume()

        return resume.model_dump()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# =========================================================
# Resume Download
# =========================================================

@app.get("/resume/download")
def download_resume():

    if not RESUME_PATH.exists():

        raise HTTPException(
            status_code=404,
            detail="Resume PDF not found.",
        )

    return FileResponse(
        path=RESUME_PATH,
        media_type="application/pdf",
        filename="resume.pdf",
    )


# =========================================================
# Candidate Profile
# =========================================================

@app.get("/candidate")
def candidate():

    if not RESUME_PATH.exists():

        raise HTTPException(
            status_code=404,
            detail="Resume PDF not found.",
        )

    try:

        resume = get_parsed_resume()

        return {
            "name": resume.name,

            "summary": (
                f"{resume.total_experience_years} years of experience"
                if resume.total_experience_years is not None
                else None
            ),

            "skills": resume.skills,

            "experience": [
                {
                    "title": experience.role,
                    "subtitle": experience.company,
                    "period": experience.duration,
                }
                for experience in resume.experiences
            ],

            "education": resume.education,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# =========================================================
# Streaming Chat
# =========================================================

@app.post("/chat")
def chat(request: ChatRequest):

    question = request.question.strip()

    if not question:

        return StreamingResponse(
            iter(["Please enter a question."]),
            media_type="text/plain",
        )

    if not RESUME_PATH.exists():

        return StreamingResponse(
            iter(["Resume PDF not found."]),
            media_type="text/plain",
        )

    try:

        resume = get_parsed_resume()

    except Exception as error:

        return StreamingResponse(
            iter([
                f"Error processing resume: {str(error)}"
            ]),
            media_type="text/plain",
        )

    return StreamingResponse(
        stream_candidate_answer(
            question,
            resume,
        ),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )