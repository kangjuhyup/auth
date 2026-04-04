interface Props {
  provider: string;
  name: string;
  onClick: () => void;
}

export default function IdpButton({ provider, name, onClick }: Props) {
  return (
    <button className={`btn-idp btn-idp-${provider}`} onClick={onClick}>
      {name}으로 로그인
    </button>
  );
}
