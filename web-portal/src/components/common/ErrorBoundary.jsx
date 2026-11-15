import React from "react";

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("The portal encountered a rendering error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeContent: "center",
            gap: 16,
            padding: 24,
            background: "#111827",
            color: "#f9fafb",
            textAlign: "center",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          <h1>Something went wrong</h1>
          <p>The page could not be displayed. Reload the portal or return home.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button type="button" onClick={() => window.location.reload()}>
              Reload portal
            </button>
            <a href="/">Go to homepage</a>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
