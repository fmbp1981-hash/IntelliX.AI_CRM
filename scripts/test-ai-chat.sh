#!/bin/bash
# Test AI Chat API directly with curl
# Uso: ./scripts/test-ai-chat.sh

set -e

API_URL="http://localhost:3000/api/ai/chat"
BOARD_ID="3f347a83-b275-448e-9425-a6abde132811"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AI Chat API Test Suite${NC}"
echo "=========================================="
echo "Board ID: $BOARD_ID"
echo ""

# Test function
test_prompt() {
    local name="$1"
    local prompt="$2"
    local expected_tool="$3"
    
    echo -e "${YELLOW}🧪 Testing: $name${NC}"
    echo "   Prompt: $prompt"
    
    # Make request and capture response
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "Cookie: $AUTH_COOKIE" \
        -d "{
            \"messages\": [{
                \"id\": \"test-$(date +%s)\",
                \"role\": \"user\",
                \"content\": \"$prompt\",
                \"parts\": [{\"type\": \"text\", \"text\": \"$prompt\"}]
            }],
            \"context\": {
                \"boardId\": \"$BOARD_ID\",
                \"boardName\": \"Pipeline de Vendas\",
                \"stages\": [{\"id\": \"1\", \"name\": \"Descoberta\"}, {\"id\": \"2\", \"name\": \"Proposta\"}]
            }
        }" 2>&1)
    
    # Check for errors
    if echo "$response" | grep -q "error\|Unauthorized\|Error"; then
        echo -e "   ${RED}❌ FAILED: $response${NC}"
        return 1
    fi
    
    # Check for tool call in response
    if echo "$response" | grep -iq "$expected_tool"; then
        echo -e "   ${GREEN}✅ PASSED - Tool $expected_tool detected${NC}"
        return 0
    else
        echo -e "   ${YELLOW}⚠️  Tool $expected_tool not clearly visible in response${NC}"
        echo "   Response preview: $(echo "$response" | head -c 200)"
        return 0
    fi
}

# Check AUTH_COOKIE
if [ -z "$AUTH_COOKIE" ]; then
    echo -e "${RED}⚠️  WARNING: No AUTH_COOKIE set${NC}"
    echo ""
    echo "Get your auth cookie from browser DevTools:"
    echo "1. Open DevTools > Application > Cookies > localhost"
    echo "2. Find 'sb-umnfusuvcgzdsyxifbyj-auth-token'"
    echo "3. Copy full value including 'base64-...'"
    echo ""
    echo "Run with:"
    echo "  AUTH_COOKIE='sb-umnfusuvcgzdsyxifbyj-auth-token=base64-...' ./scripts/test-ai-chat.sh"
    echo ""
    echo "Or export it:"
    echo "  export AUTH_COOKIE='sb-umnfusuvcgzdsyxifbyj-auth-token=base64-...'"
    echo ""
    exit 1
fi

# Run tests
echo ""
echo "=========================================="
echo "ANÁLISE TOOLS"
echo "=========================================="
test_prompt "analyzePipeline" "analise meu pipeline" "analyzePipeline"
sleep 2
test_prompt "getBoardMetrics" "quais são as métricas do board?" "getBoardMetrics"
sleep 2

echo ""
echo "=========================================="
echo "BUSCA TOOLS"
echo "=========================================="
test_prompt "searchDeals" "busque deals com Nike" "searchDeals"
sleep 2
test_prompt "listDealsByStage" "quantos deals em Proposta?" "listDealsByStage"
sleep 2
test_prompt "listStagnantDeals" "deals parados há mais de 5 dias" "listStagnantDeals"
sleep 2

echo ""
echo "=========================================="
echo "FINISHED"
echo "=========================================="
echo ""
echo "Verifique os logs do servidor em npm run dev para detalhes das tool calls."
