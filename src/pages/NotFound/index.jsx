import React from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Home, Compass } from 'lucide-react'
import { useAppSelector } from '../../redux/hooks'
import { selectIsAuth } from '../../redux/slices/authSlice'
import WorkshopLogo from '../../components/WorkshopLogo'

export default function NotFound() {
  const isAuth = useAppSelector(selectIsAuth)
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top brand header */}
      <header style={{ padding: '24px 32px' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <WorkshopLogo size={28} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>workshop</span>
        </Link>
      </header>

      {/* Main 404 card */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          background: '#ffffff',
          padding: '48px 36px',
          borderRadius: 16,
          boxShadow: '0 10px 30px -5px rgba(0,0,0,0.06), 0 4px 6px -2px rgba(0,0,0,0.02)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <Compass size={32} />
          </div>

          <span style={{
            fontSize: '3.5rem',
            fontWeight: 900,
            color: '#0f172a',
            lineHeight: 1,
            display: 'block',
            letterSpacing: '-0.04em',
            marginBottom: 8
          }}>
            404
          </span>

          <h1 style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 10px'
          }}>
            Page not found
          </h1>

          <p style={{
            fontSize: '0.92rem',
            color: '#64748b',
            lineHeight: 1.5,
            margin: '0 0 28px'
          }}>
            Sorry, the page you are looking for doesn&apos;t exist, has been removed, or was moved to another address.
          </p>

          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeft size={16} /> Go back
            </button>

            <Link
              to={isAuth ? '/dashboard' : '/'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '0.88rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Home size={16} /> {isAuth ? 'Dashboard' : 'Home'}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
