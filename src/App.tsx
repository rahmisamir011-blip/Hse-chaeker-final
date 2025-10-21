import { useState } from 'react';
import './App.css';

export default function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
      setResult(null);
      setError(null);
    }
  };

  const analyzeImage = async () => {
    if (!image) {
      setError('Please select an image first');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + import.meta.env.VITE_OPENAI_API_KEY
          },
          body: JSON.stringify({
            model: 'gpt-4-vision',
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze PPE compliance. Check: Hairnet, Mask, Protective suit, Gloves, Safety shoes. Return JSON: {findings:[{ppeItem:string,compliant:boolean,reason:string}],summary:string,overallCompliant:boolean}'
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:${image.type};base64,${base64}` }
                }
              ]
            }],
            max_tokens: 500
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'API error');
        }

        let text = data.choices[0].message.content;
        if (text.includes('```
          text = text.replace(/```json/g, '').replace(/```
        }

        const result = JSON.parse(text);
        setResult(result);
      };
      reader.readAsDataURL(image);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>فحص معدات الوقاية الشخصية</h1>
        <p>PPE Analysis Tool</p>
      </div>

      <div className="upload-section">
        <label htmlFor="imageInput" className="upload-btn">
          📸 اختر صورة
        </label>
        <input
          id="imageInput"
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
      </div>

      {preview && (
        <div className="preview">
          <img src={preview} alt="Preview" />
        </div>
      )}

      {preview && !result && (
        <button
          className="analyze-btn"
          onClick={analyzeImage}
          disabled={analyzing}
        >
          {analyzing ? 'جاري التحليل...' : 'تحليل الصورة'}
        </button>
      )}

      {error && (
        <div className="error">
          <p>❌ خطأ: {error}</p>
        </div>
      )}

      {result && (
        <div className="results">
          <h2>النتائج</h2>
          <div className="summary">
            <p><strong>الملخص:</strong> {result.summary}</p>
            <p>
              <strong>الحالة العامة:</strong>{' '}
              {result.overallCompliant ? '✅ متطابق' : '❌ غير متطابق'}
            </p>
          </div>

          <div className="findings">
            {result.findings.map((item, idx) => (
              <div key={idx} className="finding-item">
                <h4>{item.ppeItem}</h4>
                <p>الحالة: {item.compliant ? '✅' : '❌'}</p>
                <p>السبب: {item.reason}</p>
              </div>
            ))}
          </div>

          <button
            className="analyze-btn"
            onClick={() => {
              setResult(null);
              setPreview(null);
              setImage(null);
            }}
          >
            فحص صورة جديدة
          </button>
        </div>
      )}
    </div>
  );
          }
