export default function RatingInput({ value, onChange, size = 'md' }) {
  const stars = [1, 2, 3, 4, 5]

  const handleClick = (n) => {
    // 같은 값을 다시 누르면 별점 해제 (null)
    if (value === n) onChange(null)
    else onChange(n)
  }

  return (
    <div className={`rating-input rating-input--${size}`} role="radiogroup">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          className={`rating-star ${value && n <= value ? 'is-on' : ''}`}
          onClick={() => handleClick(n)}
          aria-label={`${n}점`}
          role="radio"
          aria-checked={value === n}
        >
          ★
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          className="rating-clear"
          onClick={() => onChange(null)}
          aria-label="별점 지우기"
          title="별점 지우기"
        >
          ×
        </button>
      )}
    </div>
  )
}
