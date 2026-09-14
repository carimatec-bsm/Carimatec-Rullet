import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application error", error.message, info.componentStack);
  }
  render() {
    if (this.state.error)
      return (
        <main className="fatal-error">
          <h1>화면을 준비하지 못했습니다.</h1>
          <p>{this.state.error}</p>
          <p>저장 데이터를 삭제하지 말고 운영자에게 알려주세요.</p>
          <button className="button primary" onClick={() => location.reload()}>
            다시 불러오기
          </button>
        </main>
      );
    return this.props.children;
  }
}
