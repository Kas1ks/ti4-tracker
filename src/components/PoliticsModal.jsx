import { ALL_FACTIONS } from '../data/gameData';
import { isAgendaFullyVoted } from '../utils/game';

export function PoliticsModal({
  show,
  minimized,
  onMinimize,
  onClose,
  politicsStep,
  setPoliticsStep,
  agendas,
  setAgendas,
  currentAgendaIndex,
  setCurrentAgendaIndex,
  activePlayers,
  players,
  setPlayers,
  speakerId,
  setSpeakerId,
  onFinish,
}) {
  if (!show) return null;

  const currentAgenda = agendas[currentAgendaIndex];

  const setAgendaType = (type) => {
    setAgendas(agendas.map((agenda, index) => {
      if (index === currentAgendaIndex) {
        return { ...agenda, type, customChoices: type === 'OTHER' ? [''] : undefined };
      }
      return agenda;
    }));
  };

  const setAgendaVotes = (playerId, vote) => {
    const newAgendas = [...agendas];
    newAgendas[currentAgendaIndex].votes[playerId] = vote;
    setAgendas(newAgendas);
  };

  const lockVote = (playerId) => {
    const newAgendas = [...agendas];
    newAgendas[currentAgendaIndex].locked[playerId] = true;
    setAgendas(newAgendas);
  };

  const handleNextAgenda = () => {
    const nextIndex = currentAgendaIndex + 1;
    if (!agendas[nextIndex]) {
      setAgendas([...agendas, { type: null, votes: {}, locked: {}, customChoices: undefined }]);
    }
    setCurrentAgendaIndex(nextIndex);
  };

  const handleSkipAgenda = () => {
    handleNextAgenda();
  };

  const setCustomChoices = (newChoices) => {
    setAgendas(agendas.map((agenda, index) => (
      index === currentAgendaIndex ? { ...agenda, customChoices: newChoices } : agenda
    )));
  };

  const voteTotals = (() => {
    if (!currentAgenda?.type) return {};
    const totals = {};
    Object.entries(currentAgenda.votes).forEach(([playerId, vote]) => {
      if (
        currentAgenda.locked[playerId]
        && vote
        && vote.choice !== 'abstain'
        && vote.amount > 0
      ) {
        totals[vote.choice] = (totals[vote.choice] || 0) + vote.amount;
      }
    });
    return totals;
  })();

  const winningChoice = (() => {
    if (Object.keys(voteTotals).length === 0) return null;
    const sortedVotes = Object.entries(voteTotals).sort((a, b) => b[1] - a[1]);
    if (sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1] && sortedVotes[0][1] > 0) {
      return null;
    }
    return sortedVotes[0][0];
  })();

  const allVotedOnCurrentAgenda = isAgendaFullyVoted(currentAgenda, activePlayers);
  const completedAgendasCount = agendas.filter((agenda) =>
    isAgendaFullyVoted(agenda, activePlayers)
  ).length;

  const setupAllVoted = activePlayers.length > 0 && activePlayers.every(p => !!currentAgenda?.locked[p.id]);
  const currentSpeaker = activePlayers.find(p => p.id === speakerId);

  return (
    <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${minimized ? 'hidden' : ''}`}>
      <div className="bg-slate-900 border border-purple-800 rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-500/10">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
          <h2 className="font-orbitron text-lg font-bold text-purple-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-gavel" /> Фаза Политики
          </h2>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onMinimize} className="text-slate-500 hover:text-white transition">
              <i className="fa-solid fa-window-minimize text-base" />
            </button>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition">
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>
        </div>

        {politicsStep === 'SETUP' && !setupAllVoted && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Укажите количество голосов (влияния) для каждого игрока на всю фазу политики.</p>
            <div className="space-y-2">
              {activePlayers.map(p => {
                const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                return (
                  <div key={p.id} className="p-2 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={faction?.iconUrl} alt={faction?.name} className="w-8 h-8 object-contain" />
                      <div className="font-bold text-white">{p.name}</div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={p.influence || 0}
                      onChange={(e) => {
                        const influence = parseInt(e.target.value, 10) || 0;
                        setPlayers(prev => prev.map(player => (
                          player.id === p.id ? { ...player, influence } : player
                        )));
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-md w-20 text-center font-orbitron font-bold text-lg text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                );
              })}
            </div>
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPoliticsStep('VOTE')}
                className="bg-purple-600 hover:bg-purple-500 text-white font-orbitron font-extrabold py-2 px-6 rounded-xl text-sm transition uppercase"
              >
                Перейти к голосованию <i className="fa-solid fa-arrow-right" />
              </button>
            </div>
          </div>
        )}

        {politicsStep === 'VOTE' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <button type="button" onClick={() => setPoliticsStep('SETUP')} className="text-xs text-slate-400 hover:text-white font-bold flex items-center gap-1">
                <i className="fa-solid fa-arrow-left" /> Назад к голосам
              </button>
              <div className="font-orbitron font-bold text-lg text-amber-400">ЗАКОН №{currentAgendaIndex + 1}</div>
            </div>

            {!currentAgenda?.type && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <button type="button" onClick={() => setAgendaType('FOR_AGAINST')} className="p-6 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-cyan-500">
                  <div className="text-3xl">👍 / 👎</div>
                  <div className="font-bold text-cyan-400">За / Против</div>
                </button>
                <button type="button" onClick={() => setAgendaType('PLAYER_CHOICE')} className="p-6 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-amber-500">
                  <div className="text-3xl">👥</div>
                  <div className="font-bold text-amber-400">Выбор игрока</div>
                </button>
                <button type="button" onClick={() => setAgendaType('OTHER')} className="p-6 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-rose-500">
                  <div className="text-3xl">📝</div>
                  <div className="font-bold text-rose-400">Другой выбор</div>
                </button>
              </div>
            )}

            {currentAgenda?.type && (
              <>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-orbitron font-bold text-sm text-amber-400 uppercase mb-3">Итоги голосования</h4>
                  {Object.keys(voteTotals).length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(voteTotals).sort((a, b) => b[1] - a[1]).map(([choice, total]) => {
                        let choiceName = choice;
                        const isWinner = choice === winningChoice;
                        if (currentAgenda.type === 'FOR_AGAINST') {
                          choiceName = choice === 'for' ? 'ЗА' : 'ПРОТИВ';
                        } else if (currentAgenda.type === 'PLAYER_CHOICE') {
                          choiceName = players.find(pl => pl.id == choice)?.name || 'Неизвестно';
                        } else if (currentAgenda.type === 'OTHER') {
                          choiceName = currentAgenda.customChoices?.[choice] || `Вариант ${parseInt(choice, 10) + 1}`;
                        }
                        return (
                          <div key={choice} className={`bg-slate-900 p-3 rounded-xl border text-center transition-all ${isWinner ? 'border-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-800/70'}`}>
                            <div className="font-bold text-xs uppercase text-slate-400 truncate">{choiceName}</div>
                            <div className="font-orbitron font-black text-3xl text-white mt-1">{total}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-slate-500 py-4">Голоса еще не отданы.</div>
                  )}
                </div>

                {currentAgenda.type === 'OTHER' && (
                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <h4 className="font-orbitron font-bold text-sm text-rose-400 uppercase mb-2">Варианты для голосования</h4>
                    {currentAgenda.customChoices?.map((choice, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-10 text-right">#{index + 1}</span>
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => {
                            const newChoices = [...currentAgenda.customChoices];
                            newChoices[index] = e.target.value;
                            setCustomChoices(newChoices);
                          }}
                          placeholder={`Введите вариант ${index + 1}`}
                          className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-md font-bold text-sm text-white focus:outline-none focus:border-rose-400 flex-grow"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomChoices([...(currentAgenda.customChoices || []), ''])}
                      className="w-full mt-2 py-2 bg-slate-800/50 hover:bg-slate-800 border border-dashed border-slate-700 rounded-lg text-slate-400 text-xs font-bold transition"
                    >
                      + Добавить вариант
                    </button>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-slate-800">
                  {activePlayers.map(p => {
                    const vote = currentAgenda.votes[p.id] || { choice: 'abstain', amount: 0 };
                    const isLocked = !!currentAgenda.locked[p.id];
                    const votesSpentOnPrevAgendas = agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
                      const playerVote = agenda.votes[p.id];
                      if (playerVote && agenda.locked[p.id]) {
                        return acc + (playerVote.amount || 0);
                      }
                      return acc;
                    }, 0);
                    const availableInfluence = (p.influence || 0) - votesSpentOnPrevAgendas;
                    const faction = ALL_FACTIONS.find(f => f.id === p.factionId);

                    return (
                      <div key={p.id} className={`p-4 bg-slate-950 border rounded-xl flex items-center justify-between gap-4 transition ${isLocked ? 'border-purple-700/50 opacity-60' : 'border-slate-800'}`}>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <img src={faction?.iconUrl} alt={faction?.name} className="w-9 h-9 object-contain" />
                          <div className="font-bold text-lg text-white">{p.name}</div>
                          <div className="text-center w-20">
                            <div className="text-xs text-slate-400">Доступно</div>
                            <div className="font-orbitron font-black text-3xl text-amber-400">{availableInfluence}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={vote.choice}
                            onChange={e => setAgendaVotes(p.id, { ...vote, choice: e.target.value })}
                            disabled={isLocked}
                            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-400 w-32 disabled:opacity-50"
                          >
                            <option value="abstain">Воздержаться</option>
                            {currentAgenda.type === 'FOR_AGAINST' && (
                              <>
                                <option value="for">За</option>
                                <option value="against">Против</option>
                              </>
                            )}
                            {currentAgenda.type === 'PLAYER_CHOICE' && activePlayers.map(target => (
                              <option key={target.id} value={target.id}>{target.name}</option>
                            ))}
                            {currentAgenda.type === 'OTHER' && currentAgenda.customChoices?.map((opt, idx) => (
                              opt && <option key={idx} value={idx}>{opt}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            max={availableInfluence}
                            value={vote.amount}
                            onChange={(e) => {
                              const newAmount = Math.max(0, Math.min(availableInfluence, parseInt(e.target.value, 10) || 0));
                              setAgendaVotes(p.id, { ...vote, amount: newAmount });
                            }}
                            disabled={isLocked || vote.choice === 'abstain'}
                            className="bg-slate-800 border border-slate-700 rounded-md w-28 text-center font-orbitron font-black text-4xl text-cyan-400 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => lockVote(p.id)}
                            disabled={isLocked}
                            className="px-4 py-2 bg-purple-800 hover:bg-purple-700 text-sm font-bold rounded-md disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                          >
                            {isLocked ? '✓' : 'OK'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPoliticsStep('SPEAKER')}
                disabled={completedAgendasCount < 2}
                className="col-span-1 bg-emerald-600 hover:bg-emerald-500 text-white font-orbitron font-extrabold py-3 rounded-xl text-sm transition uppercase disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed"
                title={completedAgendasCount < 2 ? 'Нужно проголосовать минимум по 2 законам' : 'Перейти к выбору Спикера'}
              >
                Завершить голосование
              </button>
              <button type="button" onClick={handleSkipAgenda} className="col-span-1 bg-slate-700 hover:bg-slate-600 text-white font-orbitron font-bold py-3 rounded-xl text-sm transition uppercase">
                Пропустить закон
              </button>
              <button
                type="button"
                onClick={handleNextAgenda}
                disabled={!allVotedOnCurrentAgenda}
                className="col-span-1 bg-purple-600 hover:bg-purple-500 text-white font-orbitron font-extrabold py-3 rounded-xl text-sm transition uppercase disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed"
              >
                Следующий закон <i className="fa-solid fa-arrow-right" />
              </button>
            </div>
          </div>
        )}

        {politicsStep === 'SPEAKER' && (
          <div className="space-y-4">
            <h3 className="font-orbitron font-bold text-lg text-amber-400 text-center">Передача жетона Спикера</h3>
            <p className="text-sm text-slate-400 text-center">
              Текущий Спикер (<span className="font-bold text-white">{currentSpeaker?.name || 'Неизвестно'}</span>) выбирает следующего Спикера.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {activePlayers.map(player => {
                const faction = ALL_FACTIONS.find(f => f.id === player.factionId);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => {
                      setSpeakerId(player.id);
                      onFinish();
                    }}
                    className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-purple-500"
                  >
                    <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                    <div className="font-bold text-purple-400">{player.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
