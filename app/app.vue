<template>
  <div class="container">
    <NuxtRouteAnnouncer />
    <div class="cover-letter-app">
      <h1>Cover Letter Generator</h1>
      <p class="subtitle">Enter a company name to generate a personalized cover letter</p>
      
      <div class="form-container">
        <div class="input-group">
          <label for="company">Company Name:</label>
          <input
            id="company"
            v-model="companyName"
            type="text"
            placeholder="Enter company name"
            class="input"
            @keyup.enter="generateCoverLetter"
            :disabled="isGenerating"
          />
        </div>
        
        <button
          @click="generateCoverLetter"
          :disabled="!companyName || isGenerating"
          class="button"
        >
          <span v-if="!isGenerating">Generate & Download PDF</span>
          <span v-else>Generating...</span>
        </button>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const companyName = ref('')
const isGenerating = ref(false)
const error = ref('')

const generateCoverLetter = async () => {
  if (!companyName.value.trim()) {
    error.value = 'Please enter a company name'
    return
  }

  isGenerating.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/generate-pdf', {
      method: 'POST',
      body: {
        company: companyName.value.trim()
      },
      responseType: 'blob'
    }) as Blob

    // Create a blob from the response (already a Blob if responseType is 'blob')
    const blob = response instanceof Blob ? response : new Blob([response])
    
    // Determine file type from blob or default to PDF
    // The server sets Content-Type header, but we'll check blob type
    const isPdf = blob.type?.includes('pdf') || blob.type?.includes('application/pdf')
    const isHtml = blob.type?.includes('html') || blob.type?.includes('text/html')
    const fileExtension = isPdf ? 'pdf' : isHtml ? 'html' : 'pdf' // Default to pdf
    const fileName = `cover-letter-${companyName.value.replace(/[^a-z0-9]/gi, '-')}.${fileExtension}`
    
    const url = window.URL.createObjectURL(blob)
    
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    // Clear any previous errors
    error.value = ''
  } catch (err: unknown) {
    console.error('Error generating cover letter:', err)
    
    // Extract error message from various error types
    let errorMessage = 'Failed to generate cover letter. Please try again.'
    
    if (err && typeof err === 'object') {
      if ('data' in err && err.data && typeof err.data === 'object' && 'message' in err.data) {
        errorMessage = String(err.data.message)
      } else if ('message' in err) {
        errorMessage = String(err.message)
      }
    }
    
    error.value = errorMessage
  } finally {
    isGenerating.value = false
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  width: 100%;
  max-width: 600px;
}

.cover-letter-app {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 10px;
  text-align: center;
}

.subtitle {
  color: #666;
  text-align: center;
  margin-bottom: 30px;
  font-size: 1.1rem;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.input {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.input:focus {
  outline: none;
  border-color: #667eea;
}

.input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.button {
  padding: 14px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
}

.button:active:not(:disabled) {
  transform: translateY(0);
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 12px 16px;
  background-color: #fee;
  color: #c33;
  border-radius: 8px;
  border: 1px solid #fcc;
  font-size: 0.9rem;
}
</style>
