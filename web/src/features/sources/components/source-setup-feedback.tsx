export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

export function FeedbackMessage({
  status,
  message,
}: {
  status: "idle" | "error" | "success";
  message?: string;
}) {
  if (!message || status === "idle") {
    return null;
  }

  const isSuccess = status === "success";

  return (
    <div
      className={
        isSuccess
          ? "rounded-md border border-primary/50 bg-primary/10 p-3 text-sm text-primary"
          : "rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
      }
    >
      {message}
    </div>
  );
}
