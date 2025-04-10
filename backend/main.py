from typing import Union
import os
from urllib.request import pathname2url
from fastapi import FastAPI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.prompts import ChatPromptTemplate
from pprint import pprint
from enum import Enum
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

FILES_HOST="http://localhost:9999/files/"

CHROMA_CLINREC_PATH = r"chroma/clinrec_chroma"
CHROMA_MSD_PATH = r"chroma/msd_chroma"
CHROMA_RLS_PATH = r"chroma/rls_chroma"
SEARCH_RESULTS_NUMBER = 2
MODEL_PATH = r"models/multilingual-e5-large"

PROMPT_TEMPLATE = """
{context}
"""

class SourceType(str, Enum):
    clinrec = "clinrec"
    msd = "msd"
    rls = "rls"

app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clinrecDb = Chroma(
    persist_directory=CHROMA_CLINREC_PATH, 
    embedding_function= HuggingFaceEmbeddings(
        model_name=MODEL_PATH,
        model_kwargs={'device': 'cuda'},
        cache_folder='models')
)
msdDb = Chroma(
    persist_directory=CHROMA_MSD_PATH, 
    embedding_function= HuggingFaceEmbeddings(
        model_name=MODEL_PATH,
        model_kwargs={'device': 'cuda'},
        cache_folder='models')
)
rlsDb = Chroma(
    persist_directory=CHROMA_RLS_PATH, 
    embedding_function= HuggingFaceEmbeddings(
        model_name=MODEL_PATH,
        model_kwargs={'device': 'cuda'},
        cache_folder='models')
)

@app.get("/")
def read_root():
    return {"status": "success"}

def windows_to_linux_path(windows_path):
    # Заменяем обратные слэши на прямые
    linux_path = windows_path.replace("\\", "/")
    
    # Если путь начинается с диска (например, "C:"), заменяем его на "/c"
    if ":" in linux_path:
        drive, rest = linux_path.split(":", 1)
        linux_path = f"/{drive.lower()}{rest}"
    
    return linux_path

@app.get("/question/")
def get_question(q: str, source: SourceType):
    response = ''
    results = []
    if source is SourceType.clinrec:
        results = clinrecDb.similarity_search_with_relevance_scores(q, k=SEARCH_RESULTS_NUMBER) 
    elif source is SourceType.msd:
            results = msdDb.similarity_search_with_relevance_scores(q, k=SEARCH_RESULTS_NUMBER) 
    elif source is SourceType.rls:
        results = rlsDb.similarity_search_with_relevance_scores(q, k=SEARCH_RESULTS_NUMBER) 
        
    if len(results) == 0 or results[0][1] < 0.7:
        return  {
            "question": q,
            "prompt": "Нет фрагментов текста, на которые можно опираться для ответа.",
            "sources": []
            }
    
    pprint(results)
    context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    prompt = prompt_template.format(context=context_text)
    sources = {doc.metadata.get("file_name", None) or  doc.metadata.get("source", None) for doc, _score in results}
    sources_list = [{'name':os.path.splitext(os.path.basename(windows_to_linux_path(source)))[0],'link':f'{FILES_HOST}{pathname2url(windows_to_linux_path(source))}'} for source in sources]

    return {
            "question": q,
            "prompt": prompt,
            "sources": sources_list
            }