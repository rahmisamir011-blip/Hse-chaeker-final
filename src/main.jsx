import { useState } from 'react'
import './App.css'

function App() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result)
      reader.readAsDataURL(file)
      setResult(null)
      setError(null)
    }
  }

  const analyzeImage = async () => {
    if (!image) {
      setError('الرجاء اختيار صورة أولاً')
      return
    }

    setAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1]

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
                  text: 'Analyze PPE compliance. Check: 1.Hairnet 2.Mask 3.Protective suit 4.Gloves 5.Safety shoes. Return ONLY JSON: {"findings":[{"ppeItem":"name","compliant":true/false,"reason":"arabic"}],"summary":"arabic","overallCompliant":true/false}'
                },
                {
                  type: 'image_url',
                  image_url: { 
                    url: 'data:' + image.type + ';base64,' + base64,
                    detail: 'high'
                  }
                }
              ]
            }],
            max_tokens: 1000
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error?.message || 'API error')
        }

        let text = data.choices[0].message.content
        
        if (text.includes('```
          text = text.replace(/```json/g, '').replace(/```
        }

        const result = JSON.parse(text)
        setResult(result)
      }
      reader.readAsDataURL(image)
    } catch (err) {
      setError(err.message || 'حدث خطأ في التحليل')
      console.error(err)
    } finally {
      setAnalyzing(false)
    }
  }

  const resetApp = () => {
    setResult(null)
    setPreview(null)
    setImage(null)
    setError(null)
  }

  return (
    <div className="container">
      <div className="header">
        <h1>فحص معدات الوقاية الشخصية</h1>
        <p>HSE PPE Analysis Tool</p>
      </div>

      {!result && (
        <>
          <div className="upload-section">
            <label htmlFor="imageInput" className="upload-btn">
              📸 اختر صورة
            </label>
