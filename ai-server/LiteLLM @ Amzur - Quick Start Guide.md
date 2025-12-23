# Quick Start Guide

 **LiteLLM @ Amzur \- Quick Start Guide**

[Overview	1](#overview)

[Architecture Flow	2](#architecture-flow)

[Prerequisites	3](#prerequisites)

[Installation	3](#installation)

[Configuration	3](#configuration)

[Quick Start Examples	4](#quick-start-examples)

[Other Models Configuration:	9](#other-models-configuration:)

[Best Practices	9](#best-practices)

[1\. Always Include User ID	9](#1.-always-include-user-id)

[2\. Add Metadata for Better Analytics	10](#2.-add-metadata-for-better-analytics)

[3\. Handle Errors Gracefully	10](#3.-handle-errors-gracefully)

[4\. Use Appropriate Models for Your Task	11](#4.-use-appropriate-models-for-your-task)

[Testing Your Setup	11](#testing-your-setup)

[Monitoring and Management	12](#monitoring-and-management)

[Common Issues and Solutions	13](#common-issues-and-solutions)

[Advanced Features	13](#advanced-features)

[Support and Resources	14](#support-and-resources)

## **Overview** {#overview}

Connect to Amzur's LiteLLM proxy to access multiple AI models through a unified OpenAI-compatible API. This guide will get you started in minutes.

## 

## **Architecture Flow** {#architecture-flow}

![][image1]

## 

## 

## **Prerequisites** {#prerequisites}

* Python 3.8 or higher  
* Your LiteLLM virtual key (provided by your administrator)  
* Network access to litellm.amzur.com

## **Installation** {#installation}

Install the required package:

```shell
pip install openai
```

Optional (for environment variable management):

```shell
pip install python-dotenv
```

## **Configuration** {#configuration}

This setup is just for the OpenAI Chat model. If the model changes, the setup must change too.

**Option 1: Environment Variables (Recommended)**  
Create a .env file in your project root:

```shell
LITELLM_API_KEY=sk-your-virtual-key-here
LITELLM_PROXY_URL=https://litellm.amzur.com
USER_EMAIL=your.email@amzur.com
```

**Option 2: Direct Configuration**  
Set variables directly in your code (see examples below).

## **Quick Start Examples** {#quick-start-examples}

**1\. Basic Chat Completion**

```py
from openai import OpenAI

# Initialize client
client = OpenAI(
    api_key="sk-your-virtual-key-here",  # Your virtual key
    base_url="https://litellm.amzur.com"  # Amzur LiteLLM proxy
)

# Make a chat completion request
response = client.chat.completions.create(
    model="gpt-4o",  # or "gpt-4o-mini"
    messages=[
        {"role": "system", "content": "You are a helpful assistant."}, 
        {"role": "user", "content": "Hello! What can you help me with?"}
    ],
    max_tokens=150,
    temperature=0.7,
    user="your.email@amzur.com"  # Track usage by user
)

print(response.choices[0].message.content)
print(f"Tokens used: {response.usage.total_tokens}")
```

**2\. Streaming Chat Completion**

```py
from openai import OpenAI

client = OpenAI( 
    api_key="sk-your-virtual-key-here",
    base_url="https://litellm.amzur.com"
)

# Stream responses in real-time
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "Write a short poem about AI."}
    ],
    stream=True,
    user="your.email@amzur.com"
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

   

**3\. Text Embeddings (Single)**

```py
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-virtual-key-here",
    base_url="https://litellm.amzur.com"
)

# Generate embeddings for a single text
response = client.embeddings.create(
    model="text-embedding-3-large",  # or "text-embedding-3-small"
    input="Your text to embed goes here.",
    user="your.email@amzur.com"
)

embedding = response.data[0].embedding
print(f"Embedding dimensions: {len(embedding)}")
print(f"First 5 values: {embedding[:5]}")
```

**4\. Batch Embeddings**

```py
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-virtual-key-here",
    base_url="https://litellm.amzur.com"
)

# Generate embeddings for multiple texts at once
texts = [
    "First document to embed.",
    "Second document to embed.",
    "Third document to embed."
]

response = client.embeddings.create(
    model="text-embedding-3-small",
    input=texts,
    user="your.email@amzur.com"
)

for i, data in enumerate(response.data):
    print(f"Document {i+1}: {len(data.embedding)} dimensions")
```

**5\. With Metadata Tracking**

```py
from openai import OpenAI
import json

client = OpenAI(
    api_key="sk-your-virtual-key-here",
    base_url="https://litellm.amzur.com"
)

# Add metadata for better tracking and analytics
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Explain quantum computing briefly."}
    ],
    user="your.email@amzur.com",
    extra_body={
        "metadata": {
            "department": "ATG",
            "environment": "production",
            "application": "chatbot-v2"
        }
    },
    extra_headers={
        "x-litellm-spend-logs-metadata": json.dumps({
            "end_user": "your.email@amzur.com",
            "department": "Engineering",
            "project": "quantum-education"
        })
    }
)

print(response.choices[0].message.content)
```

**6\. Using Environment Variables**

```py
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

client = OpenAI(
    api_key=os.getenv("LITELLM_API_KEY"),
    base_url=os.getenv("LITELLM_PROXY_URL")
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    user=os.getenv("USER_EMAIL")
)

print(response.choices[0].message.content)
```

 

## 

## **Other Models Configuration:** {#other-models-configuration:}

To change  OpenAI models in LiteLLM, you need to replace the model parameter with the new provider/model (e.g., gemini-2.0-flash) and set the corresponding API key environment variable (e.g., gemini api key).

**Available Models**

**Chat Completion Models**

* gpt-4o \- Latest GPT-4 Omni model (most capable)  
* gpt-4o-mini \- Smaller, faster, cost-effective GPT-4 variant   
* Gemini-2.o-flash \- faster ,reasoning  
* The model selection is determined by the API key 

**Embedding Models**

* text-embedding-3-large \- High-quality embeddings (3072 dimensions)  
* text-embedding-3-small \- Fast, efficient embeddings (1536 dimensions)

## **Best Practices** {#best-practices}

### **1\. Always Include User ID** {#1.-always-include-user-id}

```py
# ✅ Good - tracks usage per user
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    user="your.email@amzur.com"  # Important for tracking
)

# ❌ Bad - no user tracking
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[...]
)
```

### **2\. Add Metadata for Better Analytics** {#2.-add-metadata-for-better-analytics}

```py
# Add context about your application and usage
extra_body={
    "metadata": {
        "department": "Sales",
        "application": "lead-analyzer",
        "environment": "production"
    }
}
```

### 

### **3\. Handle Errors Gracefully** {#3.-handle-errors-gracefully}

```py
from openai import OpenAI, OpenAIError

client = OpenAI(
    api_key="sk-your-virtual-key-here",
    base_url="https://litellm.amzur.com"
)

try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
        user="your.email@amzur.com"
    )
    print(response.choices[0].message.content)
    
except OpenAIError as e:
    print(f"API Error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### **4\. Use Appropriate Models for Your Task** {#4.-use-appropriate-models-for-your-task}

```py
# For complex reasoning and analysis
model = "gpt-4o"

# For simple tasks, faster responses, lower cost
model = "gpt-4o-mini"

# For semantic search and similarity
model = "text-embedding-3-large"

# For fast embedding at scale
model = "text-embedding-3-small"
```

## **Testing Your Setup** {#testing-your-setup}

```shell
cd SETUP_AMZUR/testing
python test_litellm.py
```

This script tests:

* Chat completions with all models  
* Streaming responses  
* Single and batch embeddings  
* Metadata tracking  
* Redis connection (if configured)

## **Monitoring and Management** {#monitoring-and-management}

**LiteLLM Dashboard**  
Access the web dashboard to monitor your usage:

* URL: [https://litellm.amzur.com/ui](https://litellm.amzur.com/ui)  
* Features:  
  * View API usage and costs  
  * Monitor team budgets  
  * Check rate limits  
  * Review request logs  
  * Manage virtual keys

**Health Check**

Verify the proxy is running:

```shell
curl https://litellm.amzur.com/health
```

**List Available Models**

```py
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-virtual-key-here",
    base_url="https://litellm.amzur.com"
)

models = client.models.list()
for model in models.data:
    print(model.id)
```

## **Common Issues and Solutions** {#common-issues-and-solutions}

**Issue: Connection Timeout**

```
Solution: Check your network connectivity and firewall rules
Verify: curl https://litellm.amzur.com/health
```

**Issue: Authentication Error (401)**

```
Solution: Verify your virtual key is correct and active
Check: Contact your administrator to confirm key status
```

**Issue: Rate Limit Exceeded (429)**

```
Solution: Your team has exceeded rate limits
Check: View limits in dashboard at https://litellm.amzur.com/ui
```

**Issue: Model Not Found (404)**

```
Solution: Ensure the model name is correct and available
Check: Use client.models.list() to see available models

```

## **Advanced Features** {#advanced-features}

**Caching**  
LiteLLM automatically caches responses for identical requests to reduce costs and latency.

**Load Balancing**  
Multiple API keys for the same provider are automatically load-balanced.

**Fallback Models**  
If a model fails, LiteLLM can automatically retry with fallback models (configured by admin).

**Budget Management**  
Usage is tracked per user and team with configurable budget limits.

## **Support and Resources** {#support-and-resources}

* Documentation: [https://docs.litellm.ai/](https://docs.litellm.ai/)  
* Dashboard: [https://litellm.amzur.com/ui](https://litellm.amzur.com/ui)  
* Repository: Contact your Amzur administrator  
* Issues: Report problems to your team lead or infrastructure team

# test\_litellm.py

\#\!/usr/bin/env python3  
"""  
LiteLLM @ Amzur \- Quick Start Test Script  
\==========================================

This script verifies your LiteLLM proxy setup and tests all available models.

Features Tested:  
 ✅ Chat completions (gpt-4o, gpt-4o-mini)  
 ✅ Streaming responses  
 ✅ Text embeddings (large & small)  
 ✅ Batch embeddings  
 ✅ Metadata tracking  
 ✅ Redis connectivity (optional)

Prerequisites:  
 \- Python 3.8+  
 \- pip install openai python-dotenv httpx

Usage:  
 1\. Update CONFIGURATION section below with your credentials  
 2\. Run: python test\_litellm\_quick\_guide.py  
 For full documentation, see: QUICKSTART\_GUIDE.md  
"""

import os  
import sys  
import json  
import httpx  
from openai import OpenAI

\# Load environment variables from .env file  
try:  
   from dotenv import load\_dotenv  
   \# Try to load .env from current directory first, then parent  
   if os.path.exists('.env'):  
       load\_dotenv('.env')  
   else:  
       env\_path \= os.path.join(os.path.dirname(\_\_file\_\_), '.env')  
       load\_dotenv(env\_path)  
   print("✅ Loaded environment variables from .env file\\n")  
except ImportError:  
   print("⚠️  python-dotenv not installed. Install with: pip install python-dotenv")  
   print("   Falling back to system environment variables\\n")

\# \========================================================================  
\# CONFIGURATION \- Update these values with your credentials  
\# \========================================================================

\# LiteLLM Proxy URL (use HTTPS for production)  
LITELLM\_PROXY\_URL \= os.getenv("LITELLM\_PROXY\_URL", "https://litellm.amzur.com")

\# Your virtual key from LiteLLM admin (get from dashboard)  
VIRTUAL\_KEY \= os.getenv("LITELLM\_API\_KEY", "sk-your-virtual-key-here")

\# Your Amzur email for usage tracking  
USER\_ID \= os.getenv("USER\_EMAIL", "your.email@amzur.com")

\# Optional: Customize metadata for tracking  
USER\_METADATA \= {  
   "department": os.getenv("DEPARTMENT", "ATG"),  
   "environment": os.getenv("ENVIRONMENT", "testing"),  
   "application": "litellm-quickstart-test"  
}

\# Spend logs metadata (must be JSON string)  
SPEND\_LOGS\_METADATA \= json.dumps({  
   "end\_user": USER\_ID,  
   "department": USER\_METADATA\["department"\],  
   "environment": USER\_METADATA\["environment"\]  
})

\# Models to test (configure based on your access)  
CHAT\_MODELS \= \["gpt-4o", "gpt-4o-mini"\]  
EMBEDDING\_MODELS \= \["text-embedding-3-large", "text-embedding-3-small"\]

\# \========================================================================

def validate\_configuration():  
   """Validate that required configuration is set."""  
   issues \= \[\]  
    
   if VIRTUAL\_KEY \== "sk-your-virtual-key-here":  
       issues.append("⚠️  VIRTUAL\_KEY is not set \- please update with your actual key")  
    
   if USER\_ID \== "your.email@amzur.com":  
       issues.append("⚠️  USER\_ID is not set \- please update with your Amzur email")  
    
   if LITELLM\_PROXY\_URL \== "https://litellm.amzur.com":  
       print("ℹ️  Using default proxy URL: https://litellm.amzur.com")  
    
   if issues:  
       print("\\n" \+ "="\*80)  
       print("CONFIGURATION ISSUES DETECTED")  
       print("="\*80)  
       for issue in issues:  
           print(issue)  
       print("\\nPlease update the CONFIGURATION section in this script or set environment variables.")  
       print("\\nEnvironment variables:")  
       print("  export LITELLM\_API\_KEY='sk-your-key'")  
       print("  export USER\_EMAIL='your.email@amzur.com'")  
       print("  export LITELLM\_PROXY\_URL='https://litellm.amzur.com'")  
       return False  
    
   return True

def test\_chat\_completion(client: OpenAI, model: str):  
   """Test a chat completion with the given model."""  
   print(f"\\n{'='\*80}")  
   print(f"Testing Chat Model: {model}")  
   print(f"{'='\*80}")  
    
   try:  
       response \= client.chat.completions.create(  
           model=model,  
           messages=\[  
               {"role": "system", "content": "You are a helpful assistant."},  
               {"role": "user", "content": "Say 'Hello from LiteLLM\!' and tell me what model you are."}  
           \],  
           max\_tokens=100,  
           temperature=0.7,  
           user=USER\_ID,  \# Track which user made this request  
           extra\_body={  
               "metadata": USER\_METADATA  \# Additional metadata for tracking  
           },  
           extra\_headers={  
               "x-litellm-spend-logs-metadata": SPEND\_LOGS\_METADATA \# Additional metadata for spend logs  
           }  
       )  
        
       print("✅ SUCCESS\!")  
       print(f"Model: {response.model}")  
       print(f"Response: {response.choices\[0\].message.content}")  
       print(f"Tokens used: {response.usage.total\_tokens}")  
       print(f"  \- Prompt tokens: {response.usage.prompt\_tokens}")  
       print(f"  \- Completion tokens: {response.usage.completion\_tokens}")

       return True  
        
   except Exception as e:  
       print(f"❌ FAILED\!")  
       print(f"Error: {str(e)}")  
       print(f"Error type: {type(e).\_\_name\_\_}")  
       return False

def test\_streaming\_completion(client: OpenAI, model: str):  
   """Test a streaming chat completion with the given model."""  
   print(f"\\n{'='\*80}")  
   print(f"Testing Streaming with Model: {model}")  
   print(f"{'='\*80}")  
    
   try:  
       stream \= client.chat.completions.create(  
           model=model,  
           messages=\[  
               {"role": "user", "content": "Count from 1 to 5 slowly."}  
           \],  
           max\_tokens=50,  
           stream=True,  
           user=USER\_ID,  \# Track which user made this request  
           extra\_body={  
               "metadata": {\*\*USER\_METADATA, "test\_type": "streaming"}  
           },  
           extra\_headers={  
               "x-litellm-spend-logs-metadata": SPEND\_LOGS\_METADATA  
           }        
       )  
        
       print("✅ Streaming response:")  
       print("Response: ", end="", flush=True)  
        
       for chunk in stream:  
           if chunk.choices\[0\].delta.content is not None:  
               print(chunk.choices\[0\].delta.content, end="", flush=True)  
        
       print("\\n✅ Streaming completed successfully\!")  
       return True  
        
   except Exception as e:  
       print(f"❌ FAILED\!")  
       print(f"Error: {str(e)}")  
       return False

def test\_embedding(client: OpenAI, model: str):  
   """Test an embedding with the given model."""  
   print(f"\\n{'='\*80}")  
   print(f"Testing Embedding Model: {model}")  
   print(f"{'='\*80}")  
    
   try:  
       response \= client.embeddings.create(  
           model=model,  
           input="This is a test sentence for embedding.",  
           user=USER\_ID,  \# Track which user made this request  
           extra\_body={  
               "metadata": {\*\*USER\_METADATA, "test\_type": "single\_embedding"}  
           },  
           extra\_headers={  
               "x-litellm-spend-logs-metadata": SPEND\_LOGS\_METADATA  
           }      

       )  
        
       embedding \= response.data\[0\].embedding  
        
       print("✅ SUCCESS\!")  
       print(f"Model: {response.model}")  
       print(f"Embedding dimensions: {len(embedding)}")  
       print(f"First 5 values: {embedding\[:5\]}")  
       print(f"Total tokens used: {response.usage.total\_tokens}")  
        
       return True  
        
   except Exception as e:  
       print(f"❌ FAILED\!")  
       print(f"Error: {str(e)}")  
       print(f"Error type: {type(e).\_\_name\_\_}")  
       return False

def test\_batch\_embeddings(client: OpenAI, model: str):  
   """Test batch embeddings with multiple inputs."""  
   print(f"\\n{'='\*80}")  
   print(f"Testing Batch Embeddings with Model: {model}")  
   print(f"{'='\*80}")  
    
   try:  
       texts \= \[  
           "First test sentence.",  
           "Second test sentence.",  
           "Third test sentence."  
       \]  
        
       response \= client.embeddings.create(  
           model=model,  
           input=texts,  
           user=USER\_ID,  \# Track which user made this request  
           extra\_body={  
               "metadata": {\*\*USER\_METADATA, "test\_type": "batch\_embedding", "batch\_size": len(texts)}  
           },  
           extra\_headers={  
               "x-litellm-spend-logs-metadata": SPEND\_LOGS\_METADATA  
           }  
       )  
        
       print("✅ SUCCESS\!")  
       print(f"Model: {response.model}")  
       print(f"Number of embeddings: {len(response.data)}")  
       print(f"Embedding dimensions: {len(response.data\[0\].embedding)}")  
       print(f"Total tokens used: {response.usage.total\_tokens}")  
        
       return True  
        
   except Exception as e:  
       print(f"❌ FAILED\!")  
       print(f"Error: {str(e)}")  
       return False

def check\_redis\_connection():  
   """Check if Redis is accessible and LiteLLM can use it."""  
   print(f"\\n{'='\*80}")  
   print("Checking Redis Connection")  
   print(f"{'='\*80}")  
    
   try:  
       import redis  
   except ImportError:  
       print("⚠️  Redis package not installed. Skipping Redis checks.")  
       print("   Install with: pip install redis")  
       return None  
    
   redis\_host \= os.getenv('REDIS\_HOST', 'localhost')  
   redis\_port \= int(os.getenv('REDIS\_PORT', 6379))  
   redis\_password \= os.getenv('REDIS\_PASSWORD', None)  
    
   print(f"Redis configuration:")  
   print(f"  Host: {redis\_host}")  
   print(f"  Port: {redis\_port}")  
   print(f"  Password: {'\*\*\*' \+ redis\_password\[-4:\] if redis\_password else 'None'}")  
    
   if not redis\_password:  
       print("\\n⚠️  REDIS\_PASSWORD not found in environment")  
       print("   Make sure .env file exists in parent directory with REDIS\_PASSWORD set")  
    
   try:  
       r \= redis.Redis(  
           host=redis\_host,  
           port=redis\_port,  
           password=redis\_password,  
           decode\_responses=True,  
           socket\_connect\_timeout=5  
       )  
        
       response \= r.ping()  
       if response:  
           print("✅ Redis is accessible\!")  
            
           \# Get some stats  
           info \= r.info()  
           print(f"   Redis version: {info.get('redis\_version', 'N/A')}")  
           print(f"   Connected clients: {info.get('connected\_clients', 'N/A')}")  
           print(f"   Used memory: {info.get('used\_memory\_human', 'N/A')}")  
            
           \# Check for LiteLLM keys  
           all\_keys \= r.keys('\*')  
           litellm\_keys \= \[k for k in all\_keys if 'litellm' in k.lower() or 'cache' in k.lower()\]  
           if litellm\_keys:  
               print(f"   LiteLLM keys in Redis: {len(litellm\_keys)}")  
            
           return r  
       else:  
           print("❌ Redis ping failed")  
           return None  
    
   except redis.AuthenticationError as e:  
       print(f"❌ Redis authentication failed: {e}")  
       print("   Password is incorrect or not set properly")  
       return None        
   except redis.ConnectionError as e:  
       print(f"❌ Cannot connect to Redis: {e}")  
       print("   LiteLLM caching and router state will not work\!")  
       print("\\n💡 To fix:")  
       print("   1\. Make sure Redis is running: sudo systemctl status redis")  
       print("   2\. Check .env file has correct REDIS\_PASSWORD")  
       print("   3\. Test manually: redis-cli \-a 'your-password' ping")  
       return None  
   except Exception as e:  
       print(f"❌ Redis error: {e}")  
       return None

def main():  
   """Main function to run all tests."""  
   print("\\n" \+ "="\*80)  
   print("LiteLLM @ Amzur \- Quick Start Test")  
   print("="\*80)  
    
   \# Validate configuration first  
   if not validate\_configuration():  
       return 1  
    
   print(f"\\nProxy URL: {LITELLM\_PROXY\_URL}")  
   print(f"Virtual Key: {VIRTUAL\_KEY\[:20\]}..." if len(VIRTUAL\_KEY) \> 20 else f"Virtual Key: {VIRTUAL\_KEY}")  
   print(f"User ID: {USER\_ID}")  
   print(f"Metadata: {USER\_METADATA}")  
   print(f"\\nModels to test:")  
   print(f"  Chat models: {', '.join(CHAT\_MODELS)}")  
   print(f"  Embedding models: {', '.join(EMBEDDING\_MODELS)}")  
   print()  
    
   \# Check Redis connection first  
   redis\_client \= check\_redis\_connection()  
    
   \# Initialize OpenAI client pointing to LiteLLM proxy  
   \# Use http\_client parameter to handle SSL properly  
   \# Create httpx client with proper SSL handling and headers  
   http\_client \= httpx.Client(  
       verify=True,  \# Verify SSL certificates  
       timeout=60.0,  \# Set reasonable timeout  
       headers={  
           "User-Agent": "curl/8.5.0"  \# Match curl's user agent to bypass potential nginx filtering  
       }  
   )  
    
   client \= OpenAI(  
       api\_key=VIRTUAL\_KEY,  
       base\_url=LITELLM\_PROXY\_URL,  
       http\_client=http\_client  
   )  
    
   results \= {  
       "chat": {},  
       "streaming": {},  
       "embeddings": {},  
       "batch\_embeddings": {}  
   }  
    
   \# Test chat models  
   print("\\n" \+ "="\*80)  
   print("PART 1: Testing Chat Completion Models")  
   print("="\*80)  
    
   for model in CHAT\_MODELS:  
       results\["chat"\]\[model\] \= test\_chat\_completion(client, model)  
    
   \# Test streaming with first chat model  
   print("\\n" \+ "="\*80)  
   print("PART 2: Testing Streaming")  
   print("="\*80)  
    
   if CHAT\_MODELS:  
       results\["streaming"\]\[CHAT\_MODELS\[0\]\] \= test\_streaming\_completion(client, CHAT\_MODELS\[0\])  
    
   \# Test embedding models  
   print("\\n" \+ "="\*80)  
   print("PART 3: Testing Embedding Models")  
   print("="\*80)  
    
   for model in EMBEDDING\_MODELS:  
       results\["embeddings"\]\[model\] \= test\_embedding(client, model)  
    
   \# Test batch embeddings with first embedding model  
   print("\\n" \+ "="\*80)  
   print("PART 4: Testing Batch Embeddings")  
   print("="\*80)  
    
   if EMBEDDING\_MODELS:  
       results\["batch\_embeddings"\]\[EMBEDDING\_MODELS\[0\]\] \= test\_batch\_embeddings(client, EMBEDDING\_MODELS\[0\])  
    
   \# Print summary  
   print("\\n" \+ "="\*80)  
   print("TEST SUMMARY")  
   print("="\*80)  
    
   \# Add Redis status to summary  
   if redis\_client:  
       print("\\n✅ Redis: CONNECTED")  
       print("   LiteLLM can use Redis for caching and routing")  
   else:  
       print("\\n⚠️  Redis: NOT CONNECTED")  
       print("   LiteLLM will work but without Redis-based features")  
    
   total\_tests \= 0  
   passed\_tests \= 0  
    
   print("\\nChat Completion Tests:")  
   for model, result in results\["chat"\].items():  
       total\_tests \+= 1  
       if result:  
           passed\_tests \+= 1  
           print(f"  ✅ {model}")  
       else:  
           print(f"  ❌ {model}")  
    
   print("\\nStreaming Tests:")  
   for model, result in results\["streaming"\].items():  
       total\_tests \+= 1  
       if result:  
           passed\_tests \+= 1  
           print(f"  ✅ {model}")  
       else:  
           print(f"  ❌ {model}")  
    
   print("\\nEmbedding Tests:")  
   for model, result in results\["embeddings"\].items():  
       total\_tests \+= 1  
       if result:  
           passed\_tests \+= 1  
           print(f"  ✅ {model}")  
       else:  
           print(f"  ❌ {model}")  
    
   print("\\nBatch Embedding Tests:")  
   for model, result in results\["batch\_embeddings"\].items():  
       total\_tests \+= 1  
       if result:  
           passed\_tests \+= 1  
           print(f"  ✅ {model}")  
       else:  
           print(f"  ❌ {model}")  
    
   print("\\n" \+ "="\*80)  
   print(f"FINAL RESULT: {passed\_tests}/{total\_tests} tests passed")  
   print("="\*80)  
    
   if passed\_tests \== total\_tests:  
       print("\\n🎉 ALL TESTS PASSED\! Your LiteLLM setup is working perfectly\!")  
       print("\\n" \+ "="\*80)  
       print("NEXT STEPS")  
       print("="\*80)  
       print("\\n1. 📖 Read the full documentation:")  
       print("   \- See QUICKSTART\_GUIDE.md for detailed examples")  
       print("   \- Learn about best practices and advanced features")  
       print("\\n2. 🔧 Start integrating into your applications:")  
       print("   \- Copy the code examples from this script")  
       print("   \- Use the client initialization pattern shown above")  
       print("\\n3. 📊 Monitor your usage:")  
       print("   \- Dashboard: https://litellm.amzur.com/ui")  
       print("   \- Track spend, budgets, and rate limits")  
       print("   \- Review request logs and analytics")  
       print("\\n4. 🤝 Share with your team:")  
       print("   \- Share the QUICKSTART\_GUIDE.md")  
       print("   \- Share this test script for verification")  
       print("   \- Contact admin for additional virtual keys")  
       return 0  
   else:  
       print(f"\\n⚠️  Some tests failed. Please check the errors above.")  
       print("\\n" \+ "="\*80)  
       print("TROUBLESHOOTING")  
       print("="\*80)  
       print("\\n1. Verify proxy is running:")  
       print("   curl https://litellm.amzur.com/health")  
       print("\\n2. Check your virtual key:")  
       print("   \- Ensure it's active in the dashboard")  
       print("   \- Verify it has access to the models you're testing")  
       print("   \- Contact your admin if key is expired or revoked")  
       print("\\n3. Review model configuration:")  
       print("   \- Check dashboard for available models")  
       print("   \- Ensure models are properly configured")  
       print("\\n4. Check network connectivity:")  
       print("   \- Verify you can reach litellm.amzur.com")  
       print("   \- Check firewall rules and proxy settings")  
       print("\\n5. Review LiteLLM logs:")  
       print("   \- Check server logs for detailed error messages")  
       print("   \- Contact infrastructure team if needed")  
       return 1

if \_\_name\_\_ \== "\_\_main\_\_":  
   sys.exit(main())

# .env.example

\# LiteLLM @ Amzur \- Configuration Template  
\# \=========================================  
\# Copy this file to .env and update with your actual values  
\#  
\# Usage:  
\#   cp .env.example .env  
\#   \# Edit .env with your credentials  
\#   python test\_litellm\_quick\_guide.py

\# Required: Your LiteLLM virtual key (get from admin or dashboard)  
LITELLM\_API\_KEY=sk-your-virtual-key-here

\# Required: Your Amzur email for usage tracking  
USER\_EMAIL=your.email@amzur.com

\# Optional: LiteLLM proxy URL (default: https://litellm.amzur.com)  
LITELLM\_PROXY\_URL=https://litellm.amzur.com

\# Optional: Metadata for tracking and analytics  
DEPARTMENT=ATG  
ENVIRONMENT=development

\# Optional: Redis configuration (only if you're running Redis locally)  
\# REDIS\_HOST=localhost  
\# REDIS\_PORT=6379  
\# REDIS\_PASSWORD=your-redis-password

\# Notes:  
\# \- Get your virtual key from: https://litellm.amzur.com/ui  
\# \- Never commit .env file to version control  
\# \- Keep your virtual key secure and don't share it  
\# \- Contact your admin if you need a new virtual key

[image1]: <data:image/png;base64,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>