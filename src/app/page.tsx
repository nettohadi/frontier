import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Frontier Video Generator</h1>
      <p style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard" style={{ color: '#0070f3', fontSize: '1.2rem' }}>
          → Open Dashboard
        </Link>
      </p>
      <p>API endpoints:</p>
      <ul>
        <li><code>POST /api/videos</code> - Create a video job</li>
        <li><code>GET /api/videos</code> - List videos</li>
        <li><code>GET /api/videos/:id</code> - Get video status</li>
        <li><code>POST /api/videos/batch</code> - Create multiple videos</li>
      </ul>
    </main>
  );
}
