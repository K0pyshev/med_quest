import React, { useState, useRef, useEffect } from 'react';
import { ReactComponent as Upward } from './icons/arrow_upward_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm'



const App = () => {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);
  const [value, setValue] = useState("");
  const [previousChats, setPreviousChats] = useState([])
  const [currentTitle, setCurrentTitle] = useState(null)
  const [source, setSource] = useState("msd")

  const handleSourceClick = (src) => {
    setSource(src);
  };

  const createNewChat = () => {
    setMessage(null)
    setValue("")
    setCurrentTitle(null)
  }

  const handleClick = (uniqueTitle) => {
    setCurrentTitle(uniqueTitle)
    setMessage(null)
    setValue("")
  }



  const getContext = async () => {
    const options = {
      method: "POST",
      body: JSON.stringify({
        message: value,
        source: source
      }),
      headers: {
        "Content-Type": "application/json"
      }
    };

    try {
      const response = await fetch('http://localhost:8000/context', options);
      const data = await response.json();
      console.log(data);
      return {
        prompt: data.prompt,
        source: data.sources
      };
    } catch (error) {
      console.error(error);
      return {
        prompt: "",
        source: []
      }
    }
  }
  const getMessages = async () => {
    setLoading(true); // Включаем анимацию загрузки
    const context = await getContext()
    const options = {
      method: "POST",
      body: JSON.stringify({
        message: context.prompt
      }),
      headers: {
        "Content-Type": "application/json"
      }
    };

    try {
      const response = await fetch('http://localhost:8000/completions', options);
      const data = await response.json();
      console.log(data);
      setMessage(data.choices[0].message);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false); // Выключаем анимацию в любом случае (успех или ошибка)
    }
  };


  const handleInput = () => {
    const textarea = textareaRef.current;
    textarea.style.height = 'auto'; // Сбрасываем высоту, чтобы пересчитать
    const lines = textarea.value.split('\n'); // Разделяем текст на строки
    const lineCount = lines.length; // Считаем количество строк
    const maxHeight = 150; // Максимальная высота текстового поля
    const lineHeight = 24; // Высота одной строки (примерное значение)
    const minHeight = 50; // Минимальная высота текстового поля

    // Устанавливаем высоту только если введена новая строка
    const newHeight = Math.min(lineCount * lineHeight, maxHeight);
    textarea.style.height = `${Math.max(newHeight, minHeight)}px`;
  };

  useEffect(() => {
    console.log(currentTitle, value, message)
    if (!currentTitle && value && message) {
      setCurrentTitle(value)
    }
    if (currentTitle && value && message) {
      setPreviousChats(prevChats => (
        [...prevChats,
        {
          title: currentTitle,
          role: "user",
          content: value
        },
        {
          title: currentTitle,
          role: message.role,
          content: message.content
        }
        ]
      ))
      setValue("")
    }
  }, [message, currentTitle])


  const currentChat = previousChats.filter(previousChats => previousChats.title === currentTitle)
  const uniqueTitles = Array.from(new Set(previousChats.map(previousChats => previousChats.title)))


  return (
    <div className="App">
      <section className="side-bar">
        <button onClick={createNewChat}>Новый чат</button>
        <p className="source-title">Источник поиска</p>
        <div className="source-options">
          <button
            className={`source-button ${source === 'msd' ? 'active' : ''}`}
            onClick={() => handleSourceClick('msd')}
          >
            MSD справочник
          </button>
          <button
            className={`source-button ${source === 'clinrec' ? 'active' : ''}`}
            onClick={() => handleSourceClick('clinrec')}
          >
            Клинические рекомендации
          </button>
        </div>
        <ul className="history">
          <p className="history-title">История</p>

          {uniqueTitles?.map((uniqueTitles, index) => <li key={index} onClick={() => handleClick(uniqueTitles)}>{uniqueTitles}</li>)}
        </ul>
        <nav>
          <p>Посмотреть планы</p>
        </nav>
      </section>
      <section className="main">
        {!currentTitle && <h1 className="Name">MedQuest</h1>}
        <ul className="feed">
          {currentChat?.map((chatMessage, index) => <li className="feed-item" key={index}>
            <p className="role">{chatMessage.role}</p>
            <p className='message'>
              <Markdown remarkPlugins={[remarkGfm]}>{chatMessage.content}</Markdown>
            </p>
          </li>)}
        </ul>
        <div className="bottom-section">
          <div className="input-container">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              ref={textareaRef}
              placeholder="Сообщение для MedQuest"
              rows={1}
              onInput={handleInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault(); // Предотвращаем создание новой строки
                  getMessages(); // Отправляем запрос
                }
              }}
              style={{
                minHeight: '50px',
                maxHeight: '150px',
              }}
            />
            <div
              id="submit"
              onClick={getMessages} // Используем getMessages напрямую
              className={loading ? 'animate' : ''}
            >
              <Upward />
            </div>
          </div>
          <p className="info">
            MedQuest может допускать ошибки. Рекомендуем проверять важную информацию
          </p>
        </div>
      </section>
    </div>
  );
};

export default App;
