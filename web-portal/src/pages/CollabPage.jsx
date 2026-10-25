import React, { useState } from 'react';
// Import your CSS module file here (adjust relative path if necessary)
import styles from '../components/common/Common.module.css';

export default function CollabPage() {
  const [showContactInfo, setShowContactInfo] = useState(false);

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '4rem 2rem' }}>
      
      {/* --- HERO / INTRO SECTION --- */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 4rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', color: '#fff', marginBottom: '1rem' }}>
          Partner with <span style={{ color: 'var(--color-accent-gold)' }}>ScenARy</span>
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
          We collaborate with creators, venues, and organizations to bring spaces to life through high-fidelity Augmented Reality.
        </p>
        <button 
          onClick={() => setShowContactInfo(true)} 
          className={styles.btnPrimary} 
          style={{ textDecoration: 'none', cursor: 'pointer', border: 'none' }}
        >
          Propose a Collaboration
        </button>
      </section>

      {/* --- BENEFITS CARDS (Using .contentCard) --- */}
      <section style={{ maxWidth: '1000px', margin: '0 auto 5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Benefit 1 */}
        <div className={styles.contentCard}>
          <div className={styles.contentImage}>
            <div className={styles.contentTitleOverlay}>
              <h3>Digital Preservation</h3>
              <p>3D Spatial Scanning & Anchoring</p>
            </div>
          </div>
          <div className={styles.contentDetails}>
            <p className={styles.contentDescription}>
              Convert historical sites, ruins, and artifacts into permanent, highly accurate 3D spatial models. Preserve fragile heritage in an immersive digital format accessible anywhere in the world.
            </p>
          </div>
        </div>

        {/* Benefit 2 */}
        <div className={styles.contentCard}>
          <div className={styles.contentImage}>
            <div className={styles.contentTitleOverlay}>
              <h3>Educational Immersion</h3>
              <p>Interactive Curriculum & Tours</p>
            </div>
          </div>
          <div className={styles.contentDetails}>
            <p className={styles.contentDescription}>
              Empower students, researchers, and visitors to interactively explore contexts on-site or remotely. Embed rich metadata, timeline triggers, and audio narratives directly into the AR space.
            </p>
          </div>
        </div>

      </section>

      {/* --- COLLABORATION PROCESS (Workflow Steps) --- */}
      <section style={{ maxWidth: '1000px', margin: '0 auto 5rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent-gold)', marginBottom: '3rem' }}>
          How Collaboration Works
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>01</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Proposal</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Submit site details, photos, or spatial scan data.</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>02</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Co-Creation</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Our spatial engine maps anchors and renders interactive scenes.</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>03</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Testing & Review</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Inspect and refine the experience in-situ with preview keys.</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>04</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Public Launch</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Publish live for visitors, students, and global explorers.</p>
          </div>
        </div>
      </section>

      {/* --- CONTACT & PROPOSAL INFO SECTION --- */}
      <section id="propose-form" className={styles.settingsContainer}>
        <div className={styles.modalContent} style={{ maxWidth: '650px', background: 'rgba(0,0,0,0.85)', margin: '0 auto', textAlign: 'left' }}>
          <div className={styles.modalHeader}>
            <h3>Collaboration Contact Details</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Ready to collaborate? Reach out to our team directly through the contact channels below.
            </p>
          </div>

          {!showContactInfo ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <button 
                onClick={() => setShowContactInfo(true)} 
                className={styles.btnPrimary}
              >
                Reveal Contact Details
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ color: 'var(--color-accent-gold)', fontWeight: 'bold', marginBottom: '0.3rem' }}>Email Proposal To:</p>
                <p style={{ color: '#fff', fontSize: '1.05rem' }}>partnerships@scenary-ar.example</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ color: 'var(--color-accent-gold)', fontWeight: 'bold', marginBottom: '0.3rem' }}>Direct Phone Lines:</p>
                <p style={{ color: '#fff', fontSize: '0.95rem', margin: '0.2rem 0' }}>+1 (555) 382-9401 (Primary)</p>
                <p style={{ color: '#fff', fontSize: '0.95rem', margin: '0.2rem 0' }}>+1 (555) 382-9402 (Support & Scanning Team)</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,258,0.08)' }}>
                <p style={{ color: 'var(--color-accent-gold)', fontWeight: 'bold', marginBottom: '0.4rem' }}>What to include in your message:</p>
                <ul style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
                  <li>Your full name and organization title</li>
                  <li>Name and location of the site, landmark, or project</li>
                  <li>Brief description of your AR goals or asset requirements</li>
                  <li>Preferred timeline for the launch</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}