// Message.jsx
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Компонент для рендеринга одного сообщения.
// Если role="assistant" и есть stream => читаем поток и отображаем ответ по частям.
// Ссылки (sourcesString) показываются только когда стрим завершён.
export function Message({ role, content, stream, sourcesString, handleError }) {
  // text — это «накапливаемый» ответ ассистента, либо готовый текст.
  const [text, setText] = useState(content || '');
  // showSources — изначально false, станет true, когда поток закончится.
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    // Если это не ассистент или нет потока => ничего не читаем
    if (role !== 'assistant' || !stream) return;

    const readStream = async () => {
      try {
        if (stream.locked) return;
        for await (const chunk of stream) {
          setText((prev) => prev + chunk);
        }
        // Когда цикл for await закончится, стрим завершён
        setShowSources(true);
      } catch (err) {
        if (handleError) handleError(err);
      }
    };
    readStream();
  }, [role, stream, handleError]);

  useEffect(() => {
    // Если это ассистент, но нет стрима (например, старое сообщение) —
    // показываем ссылки сразу (т.к. нет постепенного вывода).
    if (role === 'assistant' && !stream) {
      setShowSources(true);
    }
  }, [role, stream]);

  return (
    <li className="feed-item">
      <p className="role">{role === 'assistant' ? 'MedQuest' : 'User'}</p>

      <div className="message">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        {role === 'assistant' && showSources && sourcesString && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {sourcesString}
          </ReactMarkdown>
      )}
      </div>
    </li>
  );
}

Message.propTypes = {
  role: PropTypes.string.isRequired,
  content: PropTypes.string,
  stream: PropTypes.object,        // поток (ReadableStream)
  sourcesString: PropTypes.string, // ссылки
  handleError: PropTypes.func,
};
