import React from 'react';

const IntroPanel = ({ onSourceSelect, onSend, value, onChange }) => {
  const sources = [
    {
      id: 'msd',
      title: 'MSD справочник',
      desc: 'Надёжный медицинский источник с проверенной информацией...',
      icon: 'article_person',
      color: '#72b4f4'
    },
    {
      id: 'clinrec',
      title: 'Клинические рекомендации',
      desc: 'Официальные протоколы и стандарты лечения...',
      icon: 'assignment',
      color: '#76d275'
    },
    {
      id: 'rls',
      title: 'Энциклопедия РЛС2025',
      desc: 'Подробная информация о лекарственных препаратах...',
      icon: 'prescriptions',
      color: '#b084f7'
    }
  ];

  return (
    <div className="intro-overlay">
      <div className="intro-panel">
        <h1 className="intro-greeting">Здравствуйте</h1>
        
        <div className="intro-cards">
          {sources.map((source) => (
            <div 
              key={source.id}
              className="intro-card"
              onClick={() => onSourceSelect(source.id)}
            >
              <h3 className="intro-card-title">{source.title}</h3>
              <p className="intro-card-desc">{source.desc}</p>
              <span 
                className="material-symbols-outlined intro-icon"
                style={{ color: source.color }}
              >
                {source.icon}
              </span>
            </div>
          ))}
        </div>

        <div className="intro-input-box">
          <textarea
            value={value}
            onChange={onChange}
            placeholder="Введите ваш вопрос..."
          />
          <button onClick={onSend}>Отправить</button>
        </div>
      </div>
    </div>
  );
};

export default IntroPanel;