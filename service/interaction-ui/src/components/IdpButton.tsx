interface Props {
  provider: string;
  name: string;
  onClick: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google로 로그인',
  kakao: '카카오로 로그인',
  naver: '네이버로 로그인',
  apple: 'Apple로 로그인',
};

export default function IdpButton({ provider, name, onClick }: Props) {
  return (
    <button className="btn-idp" onClick={onClick}>
      {PROVIDER_LABELS[provider] ?? `${name}로 로그인`}
    </button>
  );
}
