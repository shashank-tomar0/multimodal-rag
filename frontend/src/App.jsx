import React, { useState, useEffect, useRef } from 'react'
import { 
  ArrowRight, 
  Upload, 
  Send, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  FileText,
  Image as ImageIcon,
  BookOpen
} from 'lucide-react'

// Import assets
import heroFace from './assets/hero_face.png'
import neuralCalibration from './assets/neural_calibration.png'
import augmentCapabilities from './assets/augment_capabilities.png'
import syncEvolve from './assets/sync_evolve.png'

const BACKEND_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [view, setView] = useState('landing') // 'landing' or 'dashboard'
  const [documents, setDocuments] = useState([])
  const [activeDoc, setActiveDoc] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [inputQuery, setInputQuery] = useState('')
  const [querying, setQuerying] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(false)
  
  const chatEndRef = useRef(null)

  // Fetch documents on load
  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
        // Sync active document if list changed
        if (activeDoc) {
          const stillExists = data.find(d => d.pdf_hash === activeDoc.pdf_hash)
          if (!stillExists) setActiveDoc(null)
        }
      }
    } catch (err) {
      console.error("Error fetching documents:", err)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setUploadProgress('parsing layout...')
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('enable_captioning', 'true') // Always enable image captioning backend-side
    formData.append('chunk_size', '800')
    formData.append('chunk_overlap', '200')

    try {
      // Simulation steps for layout parsing
      setTimeout(() => setUploadProgress('analyzing images...'), 1200)
      setTimeout(() => setUploadProgress('indexing vector space...'), 3200)
      
      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData
      })
      
      if (res.ok) {
        const data = await res.json()
        await fetchDocuments()
        setActiveDoc(data)
        setChatHistory([])
      } else {
        const errorData = await res.json()
        alert(`Ingestion failed: ${errorData.detail || 'check backend GROQ_API_KEY environment variable.'}`)
      }
    } catch (err) {
      console.error(err)
      alert("Error contacting indexing server.")
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleQuery = async (e) => {
    e.preventDefault()
    if (!inputQuery.trim() || querying || !activeDoc) return

    const question = inputQuery
    setInputQuery('')
    setQuerying(true)
    
    setChatHistory(prev => [...prev, { role: 'user', content: question }])

    try {
      const res = await fetch(`${BACKEND_URL}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          pdf_hash: activeDoc.pdf_hash,
          top_k: 4
        })
      })

      if (res.ok) {
        const data = await res.json()
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: data.answer,
          retrieved_texts: data.retrieved_texts,
          retrieved_images: data.retrieved_images
        }])
      } else {
        const err = await res.json()
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `error: ${err.detail || 'failed to get answer.'}` 
        }])
      }
    } catch (err) {
      console.error(err)
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'connection error.' 
      }])
    } finally {
      setQuerying(false)
    }
  }

  const handleClearCache = async () => {
    if (!confirm("Clear database index cache?")) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/cache`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments([])
        setActiveDoc(null)
        setChatHistory([])
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      
      {/* ----------------- LANDING VIEW ----------------- */}
      {view === 'landing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', textAlign: 'center' }}>
          
          {/* Logo symbol */}
          <div style={{ 
            width: '16px', 
            height: '16px', 
            borderRadius: '50%', 
            border: '2px solid var(--text-primary)',
            marginBottom: '32px'
          }}></div>
          
          <div className="mono-label" style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
            lumen <span className="italic-detail">_</span>
          </div>
          
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 400, 
            letterSpacing: '-0.03em', 
            marginBottom: '16px',
            color: 'var(--text-primary)'
          }}>
            Multimodal document intelligence.
          </h1>
          
          <p style={{ 
            color: 'var(--text-secondary)', 
            maxWidth: '460px', 
            fontSize: '0.95rem', 
            lineHeight: 1.5, 
            marginBottom: '40px' 
          }}>
            Analyze charts, layout structure, and text segments concurrently. Powered by local vector indexes and Vision-Language models.
          </p>
          
          <button 
            onClick={() => setView('dashboard')} 
            className="btn-apple-primary" 
            style={{ padding: '10px 20px', borderRadius: '4px' }}
          >
            Launch workspace <ArrowRight size={14} />
          </button>
          
          <footer style={{ position: 'absolute', bottom: '40px' }} className="italic-detail">
            lumen_rag v1.0.0
          </footer>
        </div>
      )}

      {/* ----------------- WORKSPACE VIEW ----------------- */}
      {view === 'dashboard' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* Header */}
          <header style={{
            height: '56px',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--bg-primary)',
            zIndex: 10
          }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              onClick={() => {
                setView('landing')
                setActiveDoc(null)
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-primary)' }}></div>
              <span className="mono-label" style={{ fontWeight: 600 }}>lumen</span>
            </div>

            {activeDoc && (
              <div className="mono-label" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="italic-detail">index: {activeDoc.filename}</span>
                <button 
                  onClick={() => setActiveDoc(null)} 
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                  className="mono-label"
                >
                  [clear]
                </button>
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={() => setView('landing')}
                className="btn-apple-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
              >
                Exit
              </button>
            </div>
          </header>

          {/* Main workspace container */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {!activeDoc ? (
              // ---------------- DOCUMENT INGESTION VIEW ----------------
              <div className="content-container" style={{ padding: '60px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                
                {/* Upload Zone */}
                {!uploading ? (
                  <div className="upload-dropzone">
                    <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: 'none' }} id="pdf-file-upload" />
                    <label htmlFor="pdf-file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
                      <span className="mono-label" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                        Drop PDF here
                      </span>
                      <span className="italic-detail" style={{ fontSize: '0.75rem' }}>
                        click to browse
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="progress-container">
                    <div className="mono-label" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textAlign: 'center' }}>
                      indexing: <span className="italic-detail">{uploadProgress}</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill"></div>
                    </div>
                  </div>
                )}

                {/* Registry list */}
                {documents.length > 0 && !uploading && (
                  <div style={{ marginTop: '50px' }}>
                    <div className="mono-label" style={{ color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>cached_indices ({documents.length}):</span>
                      <button 
                        onClick={handleClearCache}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        className="mono-label"
                      >
                        <Trash2 size={12} /> [clear_all]
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {documents.map((doc) => (
                        <div 
                          key={doc.pdf_hash}
                          onClick={() => {
                            setActiveDoc(doc)
                            setChatHistory([])
                          }}
                          style={{
                            padding: '12px 16px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'border-color 0.2s ease'
                          }}
                          className="apple-card"
                        >
                          <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>{doc.filename}</span>
                          <span className="mono-label italic-detail" style={{ fontSize: '0.75rem' }}>
                            {doc.text_chunks_count} segments • {doc.images_count} illustrations
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              // ---------------- ACTIVE CHAT WORKSPACE ----------------
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                
                {/* Chat feed */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  <div className="content-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    
                    <div className="message-container">
                      
                      {/* Init log */}
                      <div className="mono-label" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                        system: loaded index_hash={activeDoc.pdf_hash.substring(0, 8)} segments={activeDoc.text_chunks_count} images={activeDoc.images_count}
                      </div>

                      {chatHistory.map((msg, idx) => (
                        <div key={idx} className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                          
                          {/* Sender label */}
                          <div className="mono-label" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{msg.role === 'user' ? 'user' : 'lumen'}</span>
                          </div>

                          {/* Response Content */}
                          <div className="chat-response-text" style={{ whiteSpace: 'pre-line' }}>
                            {msg.content}
                          </div>

                          {/* Retrieved Image Attachments */}
                          {msg.retrieved_images && msg.retrieved_images.length > 0 && (
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div className="mono-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                visual_context:
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                {msg.retrieved_images.map((img, i) => (
                                  <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                                    <img 
                                      src={`${BACKEND_URL}${img.url}`} 
                                      alt="visual" 
                                      style={{ width: '100%', borderRadius: '2px', maxHeight: '120px', objectFit: 'contain', background: '#000', cursor: 'pointer' }}
                                      onClick={() => window.open(`${BACKEND_URL}${img.url}`, '_blank')}
                                    />
                                    <div className="mono-label italic-detail" style={{ fontSize: '0.65rem', marginTop: '6px', lineHeight: 1.2 }}>
                                      page {img.page}: {img.caption}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cited segments expander */}
                          {msg.retrieved_texts && msg.retrieved_texts.length > 0 && (
                            <details style={{ marginTop: '14px' }}>
                              <summary className="mono-label italic-detail" style={{ fontSize: '0.7rem', cursor: 'pointer', outline: 'none' }}>
                                citations ({msg.retrieved_texts.length})
                              </summary>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                {msg.retrieved_texts.map((source, sIdx) => (
                                  <div key={sIdx} style={{ fontSize: '0.75rem', padding: '6px 10px', borderLeft: '1px solid var(--border-color)', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                                    <div className="mono-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                      segment {sIdx + 1} — page {source.page}
                                    </div>
                                    "{source.content}"
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                        </div>
                      ))}

                      {querying && (
                        <div className="mono-label italic-detail" style={{ color: 'var(--text-muted)' }}>
                          lumen is reasoning with vision model...
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>

                    {/* Query input */}
                    <form onSubmit={handleQuery} style={{
                      padding: '24px 0 40px 0',
                      display: 'flex',
                      gap: '12px',
                      backgroundColor: 'var(--bg-primary)',
                      position: 'sticky',
                      bottom: 0
                    }}>
                      <input 
                        type="text"
                        value={inputQuery}
                        onChange={(e) => setInputQuery(e.target.value)}
                        placeholder="Ask anything..."
                        disabled={querying}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid var(--border-color)',
                          color: 'white',
                          padding: '8px 0',
                          fontSize: '0.95rem',
                          outline: 'none',
                          borderRadius: 0
                        }}
                      />
                      <button 
                        type="submit" 
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px'
                        }}
                        disabled={querying || !inputQuery.trim()}
                      >
                        <Send size={16} />
                      </button>
                    </form>

                  </div>
                </div>

                {/* Collapsible details sidebar option */}
                <div style={{
                  position: 'fixed',
                  bottom: '24px',
                  right: '24px',
                  zIndex: 20
                }}>
                  <button 
                    onClick={() => setExplorerOpen(!explorerOpen)}
                    style={{
                      background: '#18181b',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      borderRadius: '4px',
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                    className="mono-label"
                  >
                    {explorerOpen ? '[close_explorer]' : '[explore_indexes]'}
                  </button>
                </div>

                {/* Document Explorer Drawer */}
                {explorerOpen && (
                  <div style={{
                    width: '320px',
                    borderLeft: '1px solid var(--border-color)',
                    backgroundColor: '#0c0c0e',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    <div className="mono-label" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
                      index_explorer
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      <div>
                        <div className="mono-label" style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>document_specs:</div>
                        <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>filename: {activeDoc.filename}</div>
                          <div>hash: {activeDoc.pdf_hash.substring(0, 12)}...</div>
                          <div>chunks: {activeDoc.text_chunks_count}</div>
                          <div>images: {activeDoc.images_count}</div>
                        </div>
                      </div>

                      {activeDoc.image_chunks && activeDoc.image_chunks.length > 0 && (
                        <div>
                          <div className="mono-label" style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>extracted_illustrations:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activeDoc.image_chunks.map((img, i) => (
                              <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <img 
                                  src={`${BACKEND_URL}/images/${activeDoc.pdf_hash}/${img.name || img.path.split(/[\\/]/).pop()}`} 
                                  alt="extract" 
                                  style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#000', borderRadius: '2px' }} 
                                />
                                <div style={{ fontSize: '0.7rem', overflow: 'hidden' }}>
                                  <div className="mono-label" style={{ color: 'var(--text-primary)' }}>page {img.page}</div>
                                  <div style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.2 }}>
                                    {img.caption}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

              </div>
            )}

          </main>
        </div>
      )}

    </div>
  )
}
