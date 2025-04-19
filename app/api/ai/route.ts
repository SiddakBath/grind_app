import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client (server-side only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: query must be a non-empty string' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful personal assistant that helps manage schedules, ideas, and habits. Extract relevant information from user queries to update these three categories. For schedule items, always include specific date and time information - never use 'TBD' or vague timing. If the user doesn't specify a time, ask for clarification in your response message. Respond in JSON format with 'message' containing your response to the user, and 'scheduleUpdates', 'ideasUpdates', and 'habitsUpdates' arrays containing any relevant information for those categories. Each scheduleUpdate should have 'title', 'date', 'time', and 'description' fields."
        },
        {
          role: "user",
          content: query
        }
      ],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      return NextResponse.json({ message: "I couldn't process that request." });
    }

    // Parse the JSON response
    try {
      const parsedResponse = JSON.parse(content);
      
      // Validate and normalize schedule updates
      const scheduleUpdates = Array.isArray(parsedResponse.scheduleUpdates) 
        ? parsedResponse.scheduleUpdates.map((item: any) => ({
            title: item.title || "Untitled Event",
            date: item.date || new Date().toISOString().split('T')[0],
            time: item.time || "12:00 PM",
            description: item.description || "",
            priority: ['high', 'medium', 'low'].includes(item.priority?.toLowerCase?.()) 
              ? item.priority.toLowerCase() 
              : "medium"
          }))
        : [];
      
      return NextResponse.json({
        message: parsedResponse.message || "I've processed your request.",
        scheduleUpdates,
        ideasUpdates: Array.isArray(parsedResponse.ideasUpdates) ? parsedResponse.ideasUpdates : [],
        habitsUpdates: Array.isArray(parsedResponse.habitsUpdates) ? parsedResponse.habitsUpdates : []
      });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return NextResponse.json({ message: content });
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    );
  }
} 