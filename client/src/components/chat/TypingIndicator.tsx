interface Props {
  users: Array<{ userId: string; username: string }>;
}

export default function TypingIndicator({ users }: Props) {
  if (users.length === 0) return <div className="typing-indicator" />;

  const text = users.length === 1
    ? `${users[0].username} is cooking up nonsense`
    : users.length === 2
      ? `${users[0].username} and ${users[1].username} are cooking up nonsense`
      : `${users[0].username} and ${users.length - 1} others are yapping`;

  return (
    <div className="typing-indicator">
      <div className="typing-dots"><span /><span /><span /></div>
      <span>{text}...</span>
    </div>
  );
}
