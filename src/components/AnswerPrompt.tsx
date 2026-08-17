interface AnswerPromptProps {
  onAnswer: () => void
}

export function AnswerPrompt({ onAnswer }: AnswerPromptProps) {
  return (
    <div className="answerPrompt">
      <button className="answerPromptButton" onClick={onAnswer}>
        ตอบคำถามนี้
      </button>
    </div>
  )
}
