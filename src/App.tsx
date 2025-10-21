import React, { useState, useRef } from 'react';
import { analyzeImageForPpe } from './services/geminiService';
import { AnalysisResult, PpeFinding, PpeTypeArabic } from './types';
import { ppeDetails } from './ppeDetails';
import { CameraIcon, CheckCircleIcon, SpinnerIcon, XCircleIcon, ImageIcon } from './components/icons';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const resetState = () => {
    setImageFile(null);
    setImageUrl(null);
    setAnalysisResult(null);
    setIsLoading(false);
    setError(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetState();
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      handleAnalyze(file);
      setIsModalOpen(false);
    }
  };

  const handleAnalyze = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeImageForPpe(file);
      setAnalysisResult(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMainButtonClick = () => {
    if (imageFile) {
      resetState();
    } else {
      setIsModalOpen(true);
    }
  };

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerGallery = () => galleryInputRef.current?.click();

  const renderBoundingBoxes = () => {
    if (!analysisResult || !imageRef.current) return null;

    const { naturalWidth, naturalHeight, offsetWidth, offsetHeight } = imageRef.current;
    if (naturalWidth === 0 || naturalHeight === 0) return null;

    return analysisResult.findings.map((finding, index) => {
      const color = finding.compliant ? '#66cc66' : '#ffb3b3';
      const box = finding.boundingBox;
      
      const style: React.CSSProperties = {
        position: 'absolute',
        border: `3px solid ${color}`,
        left: `${box.x * offsetWidth}px`,
        top: `${box.y * offsetHeight}px`,
        width: `${box.width * offsetWidth}px`,
        height: `${box.height * offsetHeight}px`,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      };
      
      return <div key={index} style={style} />;
    });
  };

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <h1 style={styles.title}>🏥 فحص معدات الوقاية الشخصية</h1>
      </header>

      <main style={styles.mainContent}>
        {!imageFile ? (
          <div style={styles.startScreen}>
            <h2 style={styles.startTitle}>جاهز للفحص؟</h2>
            <p style={styles.startSubtitle}>
              انقر على الزر أدناه لبدء فحص الامتثال لمعدات الوقاية الشخصية.
            </p>
            <button 
              style={styles.button} 
              onClick={handleMainButtonClick}
            >
              <CameraIcon style={styles.spinner} /> بدء الفحص
            </button>
          </div>
        ) : (
          <>
            <div style={styles.imageContainer}>
              {imageUrl && (
                <div style={{ position: 'relative' }}>
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Worker for PPE analysis"
                    style={styles.imagePreview}
                    onLoad={() => {
                      // Re-render to calc boxes
                      setAnalysisResult(res => res ? {...res} : null);
                    }}
                  />
                  {renderBoundingBoxes()}
                </div>
              )}
            </div>

            <div style={styles.controlsAndResults}>
              <button 
                style={isLoading ? {...styles.button, ...styles.buttonDisabled} : styles.button}
                onClick={handleMainButtonClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon style={styles.spinner} /> جاري التحليل...
                  </>
                ) : (
                  <>
                    <CameraIcon style={styles.spinner} /> فحص صورة جديدة
                  </>
                )}
              </button>

              {error && <div style={styles.errorBox}>{error}</div>}

              {analysisResult && (
                <div style={styles.resultsContainer}>
                  <h2 style={styles.resultsTitle}>نتائج التحليل</h2>
                  
                  <div style={analysisResult.overallCompliant ? 
                    {...styles.summaryBox, ...styles.summaryCompliant} : 
                    {...styles.summaryBox, ...styles.summaryNonCompliant}}>
                    {analysisResult.overallCompliant ? '✅' : '❌'} {analysisResult.summary}
                  </div>

                  <ul style={styles.findingsList}>
                    {analysisResult.findings.map((finding, index) => (
                      <FindingItem key={index} finding={finding} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {isModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>اختر مصدر الصورة</h3>
            <div style={styles.modalActions}>
              <button style={styles.modalButton} onClick={triggerCamera}>
                <CameraIcon style={styles.spinner} /> التقاط صورة
              </button>
              <button style={styles.modalButton} onClick={triggerGallery}>
                <ImageIcon style={styles.spinner} /> اختيار من المعرض
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

interface FindingItemProps {
  finding: PpeFinding;
}

const FindingItem: React.FC<FindingItemProps> = ({ finding }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const details = ppeDetails[finding.ppeItem];
  
  return (
    <li
      style={finding.compliant ? 
        {...styles.findingItem, ...styles.findingCompliant} : 
        {...styles.findingItem, ...styles.findingNonCompliant}}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div style={styles.findingHeader}>
        <div>
          {finding.compliant ? <CheckCircleIcon /> : <XCircleIcon />}
          {PpeTypeArabic[finding.ppeItem]}
        </div>
        <div>{finding.reason}</div>
      </div>
      {isExpanded && details && (
        <div style={styles.detailsBox}>
          <p><strong>{details.title}:</strong> {details.description}</p>
          <p><strong>مشاكل شائعة:</strong></p>
          <ul>
            {details.commonIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
    fontFamily: "sans-serif",
    color: '#333',
    direction: 'rtl',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: '20px',
    textAlign: 'center',
    borderBottom: '1px solid #ffb3b3',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'row',
    padding: '30px',
    gap: '30px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  startScreen: {
    textAlign: 'center',
    padding: '50px 20px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px'
  },
  startTitle: {
    fontSize: '2.5rem',
    margin: 0,
  },
  startSubtitle: {
    fontSize: '1.2rem',
    color: '#666',
    maxWidth: '500px',
    margin: '0 0 20px 0'
  },
  imageContainer: {
    flex: '1 1 500px',
    maxWidth: '600px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '70vh',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '2px solid #ddd',
    display: 'block',
  },
  controlsAndResults: {
    flex: '1 1 400px',
    maxWidth: '500px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  button: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    borderRadius: '50px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  buttonDisabled: {
    backgroundColor: '#a0a0a0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  spinner: {
    width: '20px',
    height: '20px',
  },
  errorBox: {
    backgroundColor: '#ffb3b3',
    color: '#721c24',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #f5c6cb',
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #ffb3b3',
  },
  resultsTitle: {
    marginTop: 0,
    marginBottom: '15px',
    borderBottom: '1px solid #ddd',
    paddingBottom: '10px',
  },
  summaryBox: {
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryCompliant: {
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
  },
  summaryNonCompliant: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
  },
  findingsList: {
    listStyleType: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  findingItem: {
    padding: '15px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  findingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  findingCompliant: {
    backgroundColor: '#e9f7eb',
    border: '1px solid #c3e6cb',
  },
  findingNonCompliant: {
    backgroundColor: '#fce8e9',
    border: '1px solid #f5c6cb',
  },
  detailsBox: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    lineHeight: '1.6',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
    width: '90%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  modalTitle: {
    marginTop: 0,
    marginBottom: '25px',
    fontSize: '1.5rem',
  },
  modalActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  modalButton: {
    backgroundColor: 'transparent',
    color: '#333',
    border: '2px solid #ddd',
    padding: '15px 20px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
};

export default App;    if (!videoRef.current ||!canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to a Blob, then to a File
    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageFile = new File([blob], "capture.jpeg", { type: "image/jpeg" });
        await analyzeImage(imageFile);
      }
    }, 'image/jpeg');
  };

  // New function to send the image to YOUR secure backend
  const analyzeImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    setIsAnalyzing(true);
    setAnalysisResult('Analyzing... Please wait.');

    try {
      // Call your own secure Netlify Function endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error |

| `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Format and display the results
      let resultText = '✅ Analysis Complete:\n\n';
      resultText += `- Charlotte: ${data.charlotte? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Bavette: ${data.bavette? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Full Suit: ${data.suit? 'Detected' : 'Not Detected'}\n`;
      
      setAnalysisResult(resultText);

    } catch (error: any) {
      console.error('Error:', error);
      setAnalysisResult(`❌ Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="App">
      <h1>HSE Compliance Checker</h1>
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted></video>
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      </div>
      <button onClick={handleCaptureAndAnalyze} disabled={isAnalyzing}>
        {isAnalyzing? 'Analyzing...' : 'Capture and Analyze'}
      </button>
      <div className="result-box">
        <pre>{analysisResult}</pre>
      </div>
    </div>
  );
}

export default App;
    if (!videoRef.current ||!canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to a Blob, then to a File
    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageFile = new File([blob], "capture.jpeg", { type: "image/jpeg" });
        await analyzeImage(imageFile);
      }
    }, 'image/jpeg');
  };

  // New function to send the image to YOUR secure backend
  const analyzeImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    setIsAnalyzing(true);
    setAnalysisResult('Analyzing... Please wait.');

    try {
      // Call your own secure Netlify Function endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error |

| `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Format and display the results
      let resultText = '✅ Analysis Complete:\n\n';
      resultText += `- Charlotte: ${data.charlotte? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Bavette: ${data.bavette? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Full Suit: ${data.suit? 'Detected' : 'Not Detected'}\n`;
      
      setAnalysisResult(resultText);

    } catch (error: any) {
      console.error('Error:', error);
      setAnalysisResult(`❌ Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="App">
      <h1>HSE Compliance Checker</h1>
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted></video>
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      </div>
      <button onClick={handleCaptureAndAnalyze} disabled={isAnalyzing}>
        {isAnalyzing? 'Analyzing...' : 'Capture and Analyze'}
      </button>
      <div className="result-box">
        <pre>{analysisResult}</pre>
      </div>
    </div>
  );
}

export default App;
    if (!videoRef.current ||!canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to a Blob, then to a File
    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageFile = new File([blob], "capture.jpeg", { type: "image/jpeg" });
        await analyzeImage(imageFile);
      }
    }, 'image/jpeg');
  };

  // New function to send the image to YOUR secure backend
  const analyzeImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file); // The key 'image' must match the backend function

    setIsAnalyzing(true);
    setAnalysisResult('Analyzing... Please wait.');

    try {
      // Call your own secure Netlify Function endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error |

| `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Format and display the results
      let resultText = '✅ Analysis Complete:\n\n';
      resultText += `- Charlotte: ${data.charlotte? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Bavette: ${data.bavette? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Full Suit: ${data.suit? 'Detected' : 'Not Detected'}\n`;
      
      setAnalysisResult(resultText);

    } catch (error: any) {
      console.error('Error:', error);
      setAnalysisResult(`❌ Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="App">
      <h1>HSE Compliance Checker</h1>
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted></video>
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      </div>
      <button onClick={handleCaptureAndAnalyze} disabled={isAnalyzing}>
        {isAnalyzing? 'Analyzing...' : 'Capture and Analyze'}
      </button>
      <div className="result-box">
        <pre>{analysisResult}</pre>
      </div>
    </div>
  );
}

export default App;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to a Blob, then to a File
    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageFile = new File([blob], "capture.jpeg", { type: "image/jpeg" });
        await analyzeImage(imageFile);
      }
    }, 'image/jpeg');
  };

  // New function to send the image to YOUR secure backend
  const analyzeImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file); // The key 'image' must match the backend function

    setIsAnalyzing(true);
    setAnalysisResult('Analyzing... Please wait.');

    try {
      // *** KEY CHANGE ***
      // Call your own secure Netlify Function endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error |

| `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Format and display the results
      let resultText = '✅ Analysis Complete:\n\n';
      resultText += `- Charlotte: ${data.charlotte? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Bavette: ${data.bavette? 'Detected' : 'Not Detected'}\n`;
      resultText += `- Full Suit: ${data.suit? 'Detected' : 'Not Detected'}\n`;
      
      setAnalysisResult(resultText);

    } catch (error: any) {
      console.error('Error:', error);
      setAnalysisResult(`❌ Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="App">
      <h1>HSE Compliance Checker</h1>
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted></video>
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      </div>
      <button onClick={handleCaptureAndAnalyze} disabled={isAnalyzing}>
        {isAnalyzing? 'Analyzing...' : 'Capture and Analyze'}
      </button>
      <div className="result-box">
        <pre>{analysisResult}</pre>
      </div>
    </div>
  );
}

export default App;
      setIsModalOpen(false);
    }
  };

  const handleAnalyze = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const result = await analyzeImageForPpe(file);
      setAnalysisResult(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMainButtonClick = () => {
    if (imageFile) {
      resetState();
    } else {
      setIsModalOpen(true);
    }
  };

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerGallery = () => galleryInputRef.current?.click();

  const renderBoundingBoxes = () => {
    if (!analysisResult || !imageRef.current) return null;

    const { naturalWidth, naturalHeight, offsetWidth, offsetHeight } = imageRef.current;
    if (naturalWidth === 0 || naturalHeight === 0) return null;

    return analysisResult.findings.map((finding, index) => {
      const color = finding.compliant ? '#66cc66' : '#ffb3b3';
      const box = finding.boundingBox;
      
      const style: React.CSSProperties = {
        position: 'absolute',
        border: `3px solid ${color}`,
        left: `${box.x * offsetWidth}px`,
        top: `${box.y * offsetHeight}px`,
        width: `${box.width * offsetWidth}px`,
        height: `${box.height * offsetHeight}px`,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      };
      
      return <div key={index} style={style}></div>;
    });
  };

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <h1 style={styles.title}>HSE Checker</h1>
      </header>
      
      <main style={styles.mainContent}>
        {!imageFile ? (
          <div style={styles.startScreen}>
              <h2 style={styles.startTitle}>جاهز للفحص؟</h2>
              <p style={styles.startSubtitle}>انقر على الزر أدناه لبدء فحص الامتثال لمعدات الوقاية الشخصية.</p>
              <button onClick={handleMainButtonClick} style={styles.button}>
                افحصني
              </button>
          </div>
        ) : (
          <>
            <div style={styles.imageContainer}>
              {imageUrl && (
                <div style={{ position: 'relative' }}>
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Worker for PPE analysis"
                    style={styles.imagePreview}
                    onLoad={() => { /* Re-render to calc boxes */ setAnalysisResult(res => res ? {...res} : null) }}
                  />
                  {renderBoundingBoxes()}
                </div>
              )}
            </div>
            
            <div style={styles.controlsAndResults}>
              <button
                onClick={handleMainButtonClick}
                disabled={isLoading}
                style={isLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon style={{...styles.spinner, animation: 'spin 1s linear infinite'}} />
                    جاري التحليل...
                  </>
                ) : 'فحص صورة أخرى'}
              </button>

              {error && <div style={styles.errorBox}>{error}</div>}

              {analysisResult && (
                <div style={styles.resultsContainer}>
                  <h2 style={styles.resultsTitle}>نتائج التحليل</h2>
                  <div style={analysisResult.overallCompliant ? {...styles.summaryBox, ...styles.summaryCompliant} : {...styles.summaryBox, ...styles.summaryNonCompliant}}>
                    {analysisResult.overallCompliant ? '✅' : '❌'} {analysisResult.summary}
                  </div>

                  <ul style={styles.findingsList}>
                    {analysisResult.findings.map((finding) => (
                      <FindingItem key={finding.ppeItem} finding={finding} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {isModalOpen && (
          <div style={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>اختر مصدر الصورة</h3>
              <div style={styles.modalActions}>
                <button style={styles.modalButton} onClick={triggerCamera}>
                  <CameraIcon style={{width: '24px', height: '24px'}}/>
                  <span>التقاط صورة</span>
                </button>
                <button style={styles.modalButton} onClick={triggerGallery}>
                  <ImageIcon style={{width: '24px', height: '24px'}}/>
                  <span>اختيار من المعرض</span>
                </button>
              </div>
            </div>
          </div>
        )}

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};


interface FindingItemProps {
  finding: PpeFinding;
}

const FindingItem: React.FC<FindingItemProps> = ({ finding }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const details = ppeDetails[finding.ppeItem];
  
  return (
    <li
      style={finding.compliant ? {...styles.findingItem, ...styles.findingCompliant} : {...styles.findingItem, ...styles.findingNonCompliant}}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div style={styles.findingHeader}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          {finding.compliant ? <CheckCircleIcon style={{color: '#28a745'}} /> : <XCircleIcon style={{color: '#dc3545'}} />}
          <span style={{fontWeight: 'bold'}}>{PpeTypeArabic[finding.ppeItem]}</span>
        </div>
        <span style={{ fontSize: '0.9rem', color: '#555', textAlign: 'left', flex: 1, marginLeft: '10px' }}>{finding.reason}</span>
      </div>
      {isExpanded && details && (
        <div style={styles.detailsBox}>
          <p><strong>{details.title}:</strong> {details.description}</p>
          <p><strong>مشاكل شائعة:</strong></p>
          <ul>
            {details.commonIssues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}
    </li>
  )
};

const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
    fontFamily: "sans-serif",
    color: '#333',
    direction: 'rtl',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: '20px',
    textAlign: 'center',
    borderBottom: '1px solid #ffb3b3',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'row',
    padding: '30px',
    gap: '30px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  startScreen: {
    textAlign: 'center',
    padding: '50px 20px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px'
  },
  startTitle: {
    fontSize: '2.5rem',
    margin: 0,
  },
  startSubtitle: {
    fontSize: '1.2rem',
    color: '#666',
    maxWidth: '500px',
    margin: '0 0 20px 0'
  },
  imageContainer: {
    flex: '1 1 500px',
    maxWidth: '600px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '70vh',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '2px solid #ddd',
    display: 'block',
  },
  controlsAndResults: {
    flex: '1 1 400px',
    maxWidth: '500px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  button: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    fontSize: '1.4rem',
    fontWeight: 'bold',
    borderRadius: '50px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  buttonDisabled: {
    backgroundColor: '#a0a0a0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  spinner: {
    width: '20px',
    height: '20px',
  },
  errorBox: {
    backgroundColor: '#ffb3b3',
    color: '#721c24',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #f5c6cb',
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #ffb3b3',
  },
  resultsTitle: {
    marginTop: 0,
    marginBottom: '15px',
    borderBottom: '1px solid #ddd',
    paddingBottom: '10px',
  },
  summaryBox: {
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryCompliant: {
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
  },
  summaryNonCompliant: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
  },
  findingsList: {
    listStyleType: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  findingItem: {
    padding: '15px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  findingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  findingCompliant: {
    backgroundColor: '#e9f7eb',
    border: '1px solid #c3e6cb',
  },
  findingNonCompliant: {
    backgroundColor: '#fce8e9',
    border: '1px solid #f5c6cb',
  },
  detailsBox: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    lineHeight: '1.6',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
    width: '90%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  modalTitle: {
    marginTop: 0,
    marginBottom: '25px',
    fontSize: '1.5rem',
  },
  modalActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  modalButton: {
    backgroundColor: 'transparent',
    color: '#333',
    border: '2px solid #ddd',
    padding: '15px 20px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
};

export default App;
