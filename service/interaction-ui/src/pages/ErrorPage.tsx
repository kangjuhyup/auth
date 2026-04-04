interface Props {
  message: string;
}

export default function ErrorPage({ message }: Props) {
  return (
    <div className="card">
      <h1>오류</h1>
      <div className="error-msg">{message}</div>
      <button
        className="btn btn-secondary"
        onClick={() => window.history.back()}
      >
        돌아가기
      </button>
    </div>
  );
}
