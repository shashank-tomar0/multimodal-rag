import React, { useState, useEffect, useRef } from 'react'
import { 
  ArrowRight, 
  Upload, 
  Send, 
  Cpu, 
  Compass, 
  HelpCircle, 
  Layers, 
  Image as ImageIcon, 
  FileText, 
  Settings, 
  Trash2, 
  ChevronRight, 
  Sparkles, 
  Moon, 
  BookOpen, 
  ExternalLink,
  ChevronLeft
} from 'lucide-react'

// Import assets
import heroFace from './assets/hero_face.png'
import neuralCalibration from './assets/neural_calibration.png'
import augmentCapabilities from './assets/augment_capabilities.png'
import syncEvolve from './assets/sync_evolve.png'

// Brand Icons
const Twitter = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
)

const Instagram = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

const BACKEND_URL = 'http://localhost:8000';

export default function App() {
  const [view, setView] = useState('landing') // 'landing' or 'dashboard'
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('groq_api_key') || '')
  
  // RAG dashboard states
  const [documents, setDocuments] = useState([])
  const [activeDoc, setActiveDoc] = useState(null) // selected doc { pdf_hash, filename, etc. }
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [inputQuery, setInputQuery] = useState('')
  const [querying, setQuerying] = useState(false)
  
  // Dashboard Configurations
  const [enableCaptioning, setEnableCaptioning] = useState(true)
  const [topK, setTopK] = useState(4)
  const [chunkSize, setChunkSize] = useState(800)
  const [chunkOverlap, setChunkOverlap] = useState(200)
  const [explorerOpen, setExplorerOpen] = useState(false)
  
  // Explorer details
  const [explorerData, setExplorerData] = useState({ text_chunks: [], image_chunks: [] })
  
  const chatEndRef = useRef(null)

  // Save Groq key to local storage
  useEffect(() => {
    localStorage.setItem('groq_api_key', groqKey)
  }, [groqKey])

  // Fetch documents on load & view change
  useEffect(() => {
    if (view === 'dashboard') {
      fetchDocuments()
    }
  }, [view])

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
        // If there's an active doc, make sure it still exists
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
    
    if (enableCaptioning && !groqKey) {
      alert("Groq API Key is required when AI Image Captioning is enabled!")
      return
    }

    setUploading(true)
    setUploadProgress('1/4 Connecting to server...')
    
    const formData = new FormData()
    formData.append('file', file)
    if (groqKey) {
      formData.append('groq_api_key', groqKey)
    }
    formData.append('enable_captioning', enableCaptioning.toString())
    formData.append('chunk_size', chunkSize.toString())
    formData.append('chunk_overlap', chunkOverlap.toString())

    try {
      setUploadProgress('2/4 Uploading and parsing PDF layout...')
      // Small timeout simulation for steps to look good in UI
      setTimeout(() => setUploadProgress('3/4 Running AI Image Captioning & Summaries...'), 1500)
      setTimeout(() => setUploadProgress('4/4 Building FAISS Vector embeddings...'), 3500)
      
      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData
      })
      
      if (res.ok) {
        const data = await res.json()
        await fetchDocuments()
        setActiveDoc(data)
        setChatHistory([])
        alert(`Successfully indexed: ${data.filename}`)
      } else {
        const errorData = await res.json()
        alert(`Upload failed: ${errorData.detail || 'Unknown error'}`)
      }
    } catch (err) {
      console.error(err)
      alert("Error uploading file.")
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleQuery = async (e) => {
    e.preventDefault()
    if (!inputQuery.trim() || querying || !activeDoc) return
    if (!groqKey) {
      alert("Please configure a valid Groq API Key first!")
      return
    }

    const question = inputQuery
    setInputQuery('')
    setQuerying(true)
    
    // Add user message immediately
    setChatHistory(prev => [...prev, { role: 'user', content: question }])

    try {
      const res = await fetch(`${BACKEND_URL}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          groq_api_key: groqKey,
          pdf_hash: activeDoc.pdf_hash,
          top_k: topK
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
          content: `Error: ${err.detail || 'Could not fetch answer from RAG engine.'}` 
        }])
      }
    } catch (err) {
      console.error(err)
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Failed to communicate with RAG server.' 
      }])
    } finally {
      setQuerying(false)
    }
  }

  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear all documents and FAISS cached indices?")) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/cache`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments([])
        setActiveDoc(null)
        setChatHistory([])
        alert("Cache cleared successfully.")
      }
    } catch (err) {
      alert("Error clearing cache.")
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* ----------------- LANDING VIEW ----------------- */}
      {view === 'landing' && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
          <div className="hero-glow"></div>
          
          {/* Header */}
          <header style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '24px 8%',
            borderBottom: '1px solid var(--border-color)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'rgba(5, 5, 5, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(0, 242, 254, 0.3)'
              }}>
                <Cpu size={18} color="#050505" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-headings)' }}>Agenta</span>
            </div>
            
            <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Future of Human <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
              </span>
              <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Company <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
              </span>
              <span style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}>Pricing</span>
              <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }}></div>
              <Moon size={18} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} />
              <button onClick={() => setView('dashboard')} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Get Started
              </button>
            </nav>
          </header>

          {/* Hero Section */}
          <main style={{ padding: '80px 8% 20px 8%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 1 }}>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '24px',
              letterSpacing: '0.05em'
            }}>
              The future is now
            </div>

            <h1 style={{ fontSize: '4.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '8px' }}>
              Transcend human limits
            </h1>
            <h1 className="text-gradient" style={{ fontSize: '4.2rem', fontWeight: 700, fontStyle: 'italic', marginBottom: '24px' }}>
              Augment your mind.
            </h1>
            
            <p style={{ 
              color: 'var(--text-secondary)', 
              maxWidth: '650px', 
              fontSize: '1.1rem', 
              lineHeight: 1.6, 
              marginBottom: '36px' 
            }}>
              Neural enhancement technology that expands memory, synthesizes voice, and connects minds. Experience the next evolution of human potential.
            </p>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
              <button onClick={() => setView('dashboard')} className="btn-primary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
                Begin Now
              </button>
              <button onClick={() => setView('dashboard')} className="btn-secondary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
                View Plans
              </button>
            </div>

            {/* Pills list slider */}
            <div style={{ width: '100%', maxWidth: '900px', overflow: 'hidden' }}>
              <div className="pills-container">
                <span className="pill-item"><Sparkles size={14} color="#00f2fe"/> Memory Expansion</span>
                <span className="pill-item"><Cpu size={14}/> Thought Transfer</span>
                <span className="pill-item"><Layers size={14}/> Brain Sync</span>
                <span className="pill-item"><Sparkles size={14} color="#4facfe"/> Cognitive Boost</span>
                <span className="pill-item"><Layers size={14}/> Neural Security</span>
                <span className="pill-item"><Compass size={14}/> Sensory Expansion</span>
                <span className="pill-item"><Sparkles size={14} color="#00f2fe"/> Neural Link</span>
                <span className="pill-item"><Cpu size={14}/> Voice Clone</span>
              </div>
            </div>

            {/* Main Sky Collage Image */}
            <div style={{ 
              width: '100%', 
              maxWidth: '850px', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              marginTop: '40px'
            }}>
              <img src={heroFace} alt="Agenta sky face collage" style={{ width: '100%', display: 'block' }} />
            </div>

            {/* Section 2: Augment in minutes */}
            <div style={{ marginTop: '120px', width: '100%', maxWidth: '1100px', textAlign: 'center' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                display: 'inline-block',
                marginBottom: '20px'
              }}>
                How it works
              </div>
              <h2 style={{ fontSize: '2.8rem', fontWeight: 800, marginBottom: '8px' }}>Augment in minutes</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '50px' }}>Three simple steps to enhance your cognitive capabilities</p>

              {/* Three Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                
                {/* Card 1: Neural Calibration */}
                <div className="glass-card" style={{ padding: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <img src={neuralCalibration} alt="Neural Calibration" style={{ width: '100%', display: 'block', height: '180px', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>01 —</span>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>Neural Calibration</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    Establish your brain-computer interface. Personalized neural mapping for optimal cognitive enhancement.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Compass size={14} color="#00f2fe" /> Brain pattern analysis</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={14} color="#00f2fe" /> Neural sync protocol</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={14} color="#00f2fe" /> Secure encryption</li>
                  </ul>
                </div>

                {/* Card 2: Augment Capabilities */}
                <div className="glass-card" style={{ padding: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <img src={augmentCapabilities} alt="Augment Capabilities" style={{ width: '100%', display: 'block', height: '180px', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>02 —</span>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>Augment Capabilities</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    Enhance memory, voice, and cognition. Choose from pre-built enhancements or custom neural pathways.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Compass size={14} color="#00f2fe" /> Memory expansion</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={14} color="#00f2fe" /> Voice synthesis</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={14} color="#00f2fe" /> Thought-to-text</li>
                  </ul>
                </div>

                {/* Card 3: Sync & Evolve */}
                <div className="glass-card" style={{ padding: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <img src={syncEvolve} alt="Sync & Evolve" style={{ width: '100%', display: 'block', height: '180px', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>03 —</span>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>Sync & Evolve</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    Seamlessly integrate enhancements. Monitor neural performance and evolve your capabilities over time.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={14} color="#00f2fe" /> Cloud sync</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Compass size={14} color="#00f2fe" /> Neural analytics</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={14} color="#00f2fe" /> Continuous learning</li>
                  </ul>
                </div>

              </div>

              {/* Dots indicator */}
              <div className="dots-indicator" style={{ marginTop: '30px' }}>
                <span className="dot active"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>

              <div style={{ marginTop: '40px' }}>
                <button onClick={() => setView('dashboard')} className="btn-outline-cyan" style={{ gap: '12px' }}>
                  Ready to transcend? <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Section 3: Dual Column Grid Layout */}
            <div style={{ marginTop: '120px', width: '100%', maxWidth: '1100px', display: 'grid', gridTemplateColumns: '4.5fr 7.5fr', gap: '24px', textAlign: 'left', marginBottom: '100px' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Social Card */}
                <div className="glass-card" style={{ padding: '24px', display: 'flex', gap: '20px' }}>
                  <img src={heroFace} alt="mini" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                      <div className="glass-card" style={{ flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Twitter size={16} />
                      </div>
                      <div className="glass-card" style={{ flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Instagram size={16} />
                      </div>
                    </div>
                    <button className="glass-card" style={{ background: 'transparent', color: 'var(--text-primary)', padding: '10px', fontSize: '0.85rem', width: '100%', cursor: 'pointer', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      Homepage
                    </button>
                  </div>
                </div>

                {/* View Innovations */}
                <div className="glass-card" style={{ flex: 1, minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', cursor: 'pointer' }}>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    View Innovations <ArrowRight size={20} />
                  </h3>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Beyond Human Astronaut Card */}
                <div className="glass-card" style={{ display: 'flex', padding: '24px', gap: '24px' }}>
                  <div style={{ width: '280px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={augmentCapabilities} alt="Beyond Human" style={{ width: '100%', display: 'block', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '10px' }}>Beyond Human</h3>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Merging consciousness with technology
                    </p>
                  </div>
                </div>

                {/* Memory Augmentation text card */}
                <div className="glass-card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>Memory Augmentation</h3>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Revolutionary systems that enhance recall, preserve memories, and expand cognitive capacity beyond biological limits.
                  </p>
                </div>
              </div>

            </div>

          </main>
        </div>
      )}

      {/* ----------------- RAG DASHBOARD VIEW ----------------- */}
      {view === 'dashboard' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100vh', backgroundColor: 'var(--bg-secondary)' }}>
          
          {/* Dashboard Sidebar */}
          <aside style={{
            width: '320px',
            backgroundColor: 'var(--bg-primary)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            
            {/* Sidebar Logo & Back */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setView('landing')}>
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '6px', 
                  background: 'var(--accent-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Cpu size={14} color="#050505" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Agenta</span>
              </div>
              <button 
                onClick={() => setView('landing')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            </div>

            {/* Groq Key Section */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                Groq API Key
              </label>
              <input 
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="Enter Groq API Key..."
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: '0.85rem'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Used for VLM generation & image descriptions.
              </span>
            </div>

            {/* Config & Parameters */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'start', gap: '8px' }}>
                <Settings size={14} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Engine Settings</span>
              </div>

              {/* Captioning Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>AI Image Captioning</span>
                <input 
                  type="checkbox"
                  checked={enableCaptioning}
                  onChange={(e) => setEnableCaptioning(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              {/* Top K */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Retrieve top-K</span>
                  <span>{topK}</span>
                </div>
                <input 
                  type="range"
                  min="2"
                  max="10"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
              </div>

              {/* Chunk Size */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Chunk Size</label>
                  <input 
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(parseInt(e.target.value))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', padding: '4px', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Overlap</label>
                  <input 
                    type="number"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', padding: '4px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Document List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600, display: 'flex', justifySelf: 'start', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={14} /> Indexed Documents ({documents.length})
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
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: activeDoc?.pdf_hash === doc.pdf_hash ? 'var(--accent-cyan)' : 'var(--border-color)',
                      background: activeDoc?.pdf_hash === doc.pdf_hash ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.filename}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '10px' }}>
                      <span>📄 {doc.text_chunks_count} chunks</span>
                      <span>🖼️ {doc.images_count} images</span>
                    </div>
                  </div>
                ))}

                {documents.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    No indexed documents yet. Upload one to start!
                  </div>
                )}
              </div>
            </div>

            {/* Clear cache button */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={handleClearCache}
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px',
                  color: '#ef4444',
                  padding: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={14} /> Clear Cache
              </button>
            </div>

          </aside>

          {/* Dashboard Main Area */}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            
            {/* Header banner */}
            <header style={{
              height: '64px',
              borderBottom: '1px solid var(--border-color)',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-primary)'
            }}>
              {activeDoc ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={16} color="var(--accent-cyan)" />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{activeDoc.filename}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'rgba(0, 242, 254, 0.1)',
                    border: '1px solid rgba(0, 242, 254, 0.3)',
                    color: 'var(--accent-cyan)',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>Active</span>
                </div>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No document selected</span>
              )}

              {activeDoc && (
                <button 
                  onClick={() => setExplorerOpen(!explorerOpen)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'white',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Layers size={14} /> 
                  {explorerOpen ? 'Hide Document Explorer' : 'Explore Document Data'}
                </button>
              )}
            </header>

            {/* Dashboard Content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
              
              {/* Left Side: Chat or Upload */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                
                {!activeDoc && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    padding: '40px'
                  }}>
                    
                    {/* Glowing uploader card */}
                    <div className="glass-card" style={{
                      maxWidth: '500px',
                      width: '100%',
                      padding: '40px',
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      <div className="hero-glow" style={{ width: '300px', height: '150px' }}></div>
                      
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: 'rgba(0, 242, 254, 0.05)',
                        border: '1px solid rgba(0, 242, 254, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto'
                      }}>
                        <Upload size={32} color="var(--accent-cyan)" />
                      </div>

                      <h3 style={{ fontSize: '1.4rem', marginBottom: '10px' }}>Upload your PDF</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
                        We will extract layout pages, parse complex text chunks, and capture visual illustrations/charts using a Vision-Language Model.
                      </p>

                      {uploading ? (
                        <div style={{ marginTop: '20px' }}>
                          <div style={{
                            fontSize: '0.9rem',
                            color: 'var(--accent-cyan)',
                            marginBottom: '10px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}>
                            <Sparkles size={16} className="active-pulse" /> {uploadProgress}
                          </div>
                          
                          {/* Animated progress bar loader */}
                          <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              position: 'absolute',
                              height: '100%',
                              width: '45%',
                              background: 'var(--accent-glow)',
                              borderRadius: '3px',
                              animation: 'pulseGlow 2s infinite'
                            }}></div>
                          </div>
                        </div>
                      ) : (
                        <label className="btn-primary" style={{ padding: '12px 24px', cursor: 'pointer', display: 'inline-flex' }}>
                          <Upload size={16} /> Choose File
                          <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {activeDoc && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    
                    {/* Chat Messages */}
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px'
                    }}>
                      
                      {chatHistory.length === 0 && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 1,
                          textAlign: 'center',
                          color: 'var(--text-secondary)',
                          opacity: 0.8
                        }}>
                          <Sparkles size={36} color="var(--accent-cyan)" style={{ marginBottom: '16px' }} />
                          <h4 style={{ color: 'white', marginBottom: '8px' }}>Ask Agenta anything</h4>
                          <p style={{ fontSize: '0.85rem', maxWidth: '350px', lineHeight: 1.5 }}>
                            Type a question about the PDF. Agenta will retrieve semantically matching text and relevant images to construct a response.
                          </p>
                        </div>
                      )}

                      {chatHistory.map((msg, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          width: '100%'
                        }}>
                          {msg.role === 'user' ? (
                            <div className="chat-message-user">
                              {msg.content}
                            </div>
                          ) : (
                            <div className="chat-message-assistant">
                              {/* Answer Text */}
                              <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'white', whiteSpace: 'pre-line' }}>
                                {msg.content}
                              </div>

                              {/* Referenced Images */}
                              {msg.retrieved_images && msg.retrieved_images.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                    <ImageIcon size={12} /> RETRIEVED VISUAL EVIDENCE
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                    {msg.retrieved_images.map((img, i) => (
                                      <div key={i} className="glass-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
                                        <img 
                                          src={`${BACKEND_URL}${img.url}`} 
                                          alt="Visual Source" 
                                          style={{ width: '100%', borderRadius: '6px', maxHeight: '180px', objectFit: 'contain', background: '#000', cursor: 'zoom-in' }}
                                          onClick={() => window.open(`${BACKEND_URL}${img.url}`, '_blank')}
                                        />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.3 }}>
                                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Page {img.page}:</span> {img.caption}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Reference Text Snippets Expander */}
                              {msg.retrieved_texts && msg.retrieved_texts.length > 0 && (
                                <details style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                                  <summary style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none', userSelect: 'none', fontWeight: 500 }}>
                                    View Referenced Text Sources ({msg.retrieved_texts.length})
                                  </summary>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: '10px' }}>
                                    {msg.retrieved_texts.map((source, sIdx) => (
                                      <div key={sIdx} className="source-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                          <span style={{ color: 'var(--accent-cyan)' }}>SOURCE #{sIdx + 1}</span>
                                          <span>Page {source.page} (dist: {source.score?.toFixed(3)})</span>
                                        </div>
                                        <div style={{ lineHeight: 1.4, fontSize: '0.8rem' }}>
                                          "{source.content}"
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}

                            </div>
                          )}
                        </div>
                      ))}

                      {querying && (
                        <div className="chat-message-assistant active-pulse" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Sparkles size={16} color="var(--accent-cyan)" className="active-pulse" />
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Retrieving context & reasoning with Vision model...
                          </span>
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <form onSubmit={handleQuery} style={{
                      padding: '20px',
                      borderTop: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      display: 'flex',
                      gap: '12px'
                    }}>
                      <input 
                        type="text"
                        value={inputQuery}
                        onChange={(e) => setInputQuery(e.target.value)}
                        placeholder="Ask a question about this document..."
                        disabled={querying}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          color: 'white',
                          padding: '12px 16px',
                          fontSize: '0.95rem',
                          outline: 'none'
                        }}
                      />
                      <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={querying || !inputQuery.trim()}
                        style={{
                          padding: '0 20px',
                          borderRadius: '8px'
                        }}
                      >
                        <Send size={16} />
                      </button>
                    </form>

                  </div>
                )}

              </div>

              {/* Right Side: Collapsible Document Explorer */}
              {activeDoc && explorerOpen && (
                <div style={{
                  width: '400px',
                  backgroundColor: 'var(--bg-primary)',
                  borderLeft: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Layers size={14} color="var(--accent-cyan)" /> Document Metadata Explorer
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Basic specs */}
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Metadata Overview</h4>
                      <div className="glass-card" style={{ padding: '12px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>File name</span>
                          <span>{activeDoc.filename}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>PDF Hash</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{activeDoc.pdf_hash.substring(0, 16)}...</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Text Chunks</span>
                          <span>{activeDoc.text_chunks_count}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Images</span>
                          <span>{activeDoc.images_count}</span>
                        </div>
                      </div>
                    </div>

                    {/* Image Captions details */}
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Extracted Images & AI Captions</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {activeDoc.image_chunks && activeDoc.image_chunks.map((img, i) => (
                          <div key={i} className="glass-card" style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                            <img 
                              src={`${BACKEND_URL}/images/${activeDoc.pdf_hash}/${img.name || img.path.split(/[\\/]/).pop()}`} 
                              alt="extract" 
                              style={{ width: '60px', height: '60px', borderRadius: '4px', objectFit: 'contain', background: 'black', flexShrink: 0 }} 
                            />
                            <div style={{ flex: 1, fontSize: '0.75rem', overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Page {img.page} Image</div>
                              <div style={{ color: 'var(--text-secondary)', marginTop: '4px', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
                                {img.caption}
                              </div>
                            </div>
                          </div>
                        ))}

                        {(!activeDoc.image_chunks || activeDoc.image_chunks.length === 0) && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            No extracted images in this document.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </section>

        </div>
      )}

    </div>
  )
}
