from typing import Union

from fastapi import FastAPI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.prompts import ChatPromptTemplate
from pprint import pprint


CHROMA_PATH = "app\chroma\clinrec_chroma"
PROMPT_TEMPLATE = """
Вы — медицинский ассистент для врачей-специалистов. Вы предоставляете информацию исключительно на основе статей из MSD справочника и клинических рекомендаций по лечению определенных заболеваний. Ваши ответы должны быть точными, основанными на этих источниках, и представлены в понятной и сжатой форме. Если информация отсутствует в указанных источниках, сообщите об этом и избегайте предположений.

Ответь на вопрос базируясь только на этом контексте: 

{context}

---

Вопрос: {question}
"""

app = FastAPI()

db = Chroma(
    persist_directory=CHROMA_PATH, 
            embedding_function= HuggingFaceEmbeddings(
       model_name='intfloat/multilingual-e5-large',
       model_kwargs={'device': 'cuda'})
)

@app.get("/")
def read_root():
    return {"status": "success"}


@app.get("/question/")
def get_question(q: str):
    response = ''
    results = db.similarity_search_with_relevance_scores(q, k=2)
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


    return {
            "question": q,
            "prompt": prompt,
            "sources": list(sources)
            }