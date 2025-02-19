// Message.jsx
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Компонент для рендеринга одного сообщения.
// Если role="assistant" и есть stream => читаем поток и отображаем ответ по частям.
// Ссылки (sourcesString) показываются только когда стрим завершён.
export function Message({
  role,
  content,
  stream,
  sourcesString,
  handleError,
  feedRef, // <-- принимаем ref из ChatFeed
}) {
  // text — это «накапливаемый» ответ ассистента, либо готовый текст.
  const [text, setText] = useState(content || '');
  // showSources — изначально false, станет true, когда поток закончится.
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    // Если это не ассистент или нет потока => ничего не читаем
    if (role !== 'assistant' || !stream) return;

    const readStream = async () => {
      try {
        // Если поток уже залочен (locked), пропускаем
        if (stream.locked) return;

        // for-await-of позволяет построчно считывать поток
        for await (const chunk of stream) {
          // Прибавляем каждый кусок текста к стейту
          setText((prev) => {
            const updated = prev + chunk;

            // После обновления текста делаем автоскролл (на следующем цикле)
            setTimeout(() => {
              if (feedRef?.current) {
                feedRef.current.scrollTo({
                  top: feedRef.current.scrollHeight,
                  behavior: 'smooth',
                });
              }
            }, 0);

            return updated;
          });
        }
        // Когда цикл завершился, стрим закончился => показываем источники
        setShowSources(true);
      } catch (err) {
        if (handleError) handleError(err);
      }
    };

    readStream();
  }, [role, stream, handleError, feedRef]);

  useEffect(() => {
    // Если это ассистент и нет стрима, значит сообщение уже готово => покажем источники
    if (role === 'assistant' && !stream) {
      setShowSources(true);
    }
  }, [role, stream]);

  return (
    <li className="feed-item">
      <p className="role">{role === 'assistant' ? 'MedQuest' : 'User'}</p>

      <div className="message">
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          remarkPlugins={[remarkGfm]}
        >
          {text}
        </ReactMarkdown>

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
  feedRef: PropTypes.object,       // ссылка на контейнер (ChatFeed)
};
