from typing import Union
import os
from urllib.request import pathname2url
from fastapi import FastAPI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.prompts import ChatPromptTemplate
from pprint import pprint
from enum import Enum

FILES_HOST="http://localhost:9999/files/"

CHROMA_CLINREC_PATH = r"chroma\clinrec_chroma"
CHROMA_MSD_PATH = r"chroma\msd_chroma"
SEARCH_RESULTS_NUMBER = 2

PROMPT_TEMPLATE = """
Вы — медицинский ассистент для врачей-специалистов. Вы предоставляете информацию исключительно на основе статей из MSD справочника и клинических рекомендаций по лечению определенных заболеваний. Ваши ответы должны быть точными, основанными на этих источниках, и представлены в понятной и сжатой форме. Если информация отсутствует в указанных источниках, сообщите об этом и избегайте предположений.

Ответь на вопрос базируясь только на этом контексте: 

{context}

---

Вопрос: {question}
"""

class SourceType(str, Enum):
    clinrec = "clinrec"
    msd = "msd"

app = FastAPI()

clinrecDb = Chroma(
    persist_directory=CHROMA_CLINREC_PATH, 
            embedding_function= HuggingFaceEmbeddings(
       model_name='intfloat/multilingual-e5-large',
       model_kwargs={'device': 'cuda'})
)
msdDb = Chroma(
    persist_directory=CHROMA_MSD_PATH, 
            embedding_function= HuggingFaceEmbeddings(
       model_name='intfloat/multilingual-e5-large',
       model_kwargs={'device': 'cuda'})
)

@app.get("/")
def read_root():
    return {"status": "success"}


@app.get("/question/")
def get_question(q: str, source: SourceType):
    response = ''
    results = []
    if source is SourceType.clinrec:
        results = clinrecDb.similarity_search_with_relevance_scores(q, k=SEARCH_RESULTS_NUMBER) 
    elif source is SourceType.msd:
            results = msdDb.similarity_search_with_relevance_scores(q, k=2) 

    if len(results) == 0 or results[0][1] < 0.7:
        return  {
            "question": q,
            "prompt": "Нет фрагментов текста, на которые можно опираться для ответа.",
            "sources": []
            }
    
    pprint(results)
    context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    prompt = prompt_template.format(context=context_text, question=q)
    sources = {doc.metadata.get("file_name", None) or  doc.metadata.get("source", None) for doc, _score in results}
    sources_list = [{'name':os.path.splitext(os.path.basename(source))[0],'link':f'{FILES_HOST}{pathname2url(source)}'} for source in sources]

    return {
            "question": q,
            "prompt": prompt,
            "sources": sources_list
            }

    