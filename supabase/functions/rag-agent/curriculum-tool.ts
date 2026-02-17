/**
 * Curriculum Search Tool
 * 
 * Provides semantic search capabilities over the Uganda curriculum database
 * stored in Qdrant vector database.
 */

// ============================================================================
// Types
// ============================================================================

export interface SearchCurriculumParams {
  query?: string;
  subject?: string;
  level?: string;
  term?: string;
  topic?: string;
  content_type?: string;
  limit?: number;
}

interface QdrantFilter {
  must: Array<{
    key: string;
    match: { value: string };
  }>;
}

interface QdrantSearchBody {
  vector: number[];
  limit: number;
  with_payload: boolean;
  filter?: QdrantFilter;
}

// ============================================================================
// Embedding Generation
// ============================================================================

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");

  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "baai/bge-m3",
        input: text,
      }),
    });

    if (!response.ok) {
      console.error("Embedding generation error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (error) {
    console.error("Embedding generation exception:", error);
    return null;
  }
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Search the Uganda curriculum database using semantic vector search
 * with optional metadata filtering.
 * 
 * @param params - Search parameters including query, subject, level, term, topic, content_type, and limit
 * @param qdrantUrl - Qdrant database URL
 * @param qdrantApiKey - Qdrant API key
 * @returns Formatted search results as a string
 */
export async function searchCurriculum(
  params: SearchCurriculumParams,
  qdrantUrl: string,
  qdrantApiKey: string
): Promise<string> {
  try {
    const {
      query = "",
      subject,
      level,
      term,
      topic,
      content_type,
      limit = 5,
    } = params;

    // Build comprehensive search query from all parameters
    const searchText = [query, subject, level, term, topic, content_type]
      .filter(Boolean)
      .join(" ");

    if (!searchText.trim()) {
      return "Error: No search parameters provided. Please specify at least one search criterion.";
    }

    // Generate embedding for semantic search
    const queryVector = await getEmbedding(searchText);
    if (!queryVector) {
      return "Error: Could not generate embedding for search query. Please try again.";
    }

    // Build metadata filter if specific parameters are provided
    const filter: QdrantFilter = { must: [] };

    if (subject) {
      filter.must.push({ key: "subject", match: { value: subject } });
    }
    if (level) {
      filter.must.push({ key: "level", match: { value: level } });
    }
    if (term) {
      filter.must.push({ key: "term", match: { value: term } });
    }
    if (topic) {
      filter.must.push({ key: "topic", match: { value: topic } });
    }
    if (content_type) {
      filter.must.push({ key: "content_type", match: { value: content_type } });
    }

    // Prepare search request body
    const searchBody: QdrantSearchBody = {
      vector: queryVector,
      limit,
      with_payload: true,
    };

    if (filter.must.length > 0) {
      searchBody.filter = filter;
    }

    // Execute search against Qdrant
    const qdrantResponse = await fetch(
      `${qdrantUrl}/collections/amooti/points/search`,
      {
        method: "POST",
        headers: {
          "api-key": qdrantApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      }
    );

    if (!qdrantResponse.ok) {
      const errorText = await qdrantResponse.text();
      console.error("Qdrant search error:", qdrantResponse.status, errorText);
      return `Error: Qdrant search failed with status ${qdrantResponse.status}`;
    }

    const qdrantData = await qdrantResponse.json();
    const results = qdrantData.result || [];

    if (results.length === 0) {
      return "No curriculum content found matching these criteria. Try broadening your search or using different parameters.";
    }

    // Format and return results
    return results
      .map((result: any) => {
        const payload = result.payload || {};
        return payload.text || payload.content || JSON.stringify(payload);
      })
      .join("\n\n---\n\n");
  } catch (error) {
    console.error("searchCurriculum error:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error occurred during search"}`;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate search parameters before executing search
 */
export function validateSearchParams(params: SearchCurriculumParams): {
  valid: boolean;
  error?: string;
} {
  const { query, subject, level, term, topic, content_type, limit } = params;

  // Check if at least one search parameter is provided
  const hasSearchCriteria = [query, subject, level, term, topic, content_type].some(
    (param) => param && param.trim().length > 0
  );

  if (!hasSearchCriteria) {
    return {
      valid: false,
      error: "At least one search parameter must be provided",
    };
  }

  // Validate limit
  if (limit !== undefined && (limit < 1 || limit > 50)) {
    return {
      valid: false,
      error: "Limit must be between 1 and 50",
    };
  }

  return { valid: true };
}

/**
 * Build a human-readable description of the search being performed
 */
export function describeSearch(params: SearchCurriculumParams): string {
  const parts: string[] = [];

  if (params.query) parts.push(`Query: "${params.query}"`);
  if (params.subject) parts.push(`Subject: ${params.subject}`);
  if (params.level) parts.push(`Level: ${params.level}`);
  if (params.term) parts.push(`Term: ${params.term}`);
  if (params.topic) parts.push(`Topic: ${params.topic}`);
  if (params.content_type) parts.push(`Content Type: ${params.content_type}`);

  return parts.join(", ");
}
