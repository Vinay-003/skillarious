import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { doubtsTable, messagesTable, contentTable, usersTable, modulesTable, coursesTable, educatorsTable } from '../db/schema.ts';
import { sendEmail } from '../utils/sendEmail.ts';
import { eq, and, desc, or, sql } from 'drizzle-orm';
import { doubtChannel, messageChannel } from '../utils/storage.ts';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  }
}

export const createDoubt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contentId, title, description } = req.body;
    const userId = req.user.id;
    const normalizedContentId = String(contentId || '').trim();
    const normalizedTitle = String(title || '').trim();
    const normalizedDescription = String(description || '').trim();

    if (!normalizedContentId || !normalizedTitle || !normalizedDescription) {
      return res.status(400).json({
        success: false,
        message: 'contentId, title and description are required'
      });
    }

    // Verify content exists
    const content = await db.select({ id: contentTable.id })
      .from(contentTable)
      .where(sql`${contentTable.id}::text = ${normalizedContentId}`)
      .limit(1);

    if (!content.length) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    const newDoubt = await db.insert(doubtsTable).values({
      date: new Date(),
      classId: content[0].id,
      contentId: normalizedContentId,
      userId,
      title: normalizedTitle,
      description: normalizedDescription,
      status: 'open',
      resolved: false
    }).returning();

    // Get educator email from the content's module's course's educator
    const educatorEmail = await db.select({
      email: usersTable.email
    })
    .from(contentTable)
    .innerJoin(modulesTable, eq(contentTable.moduleId, modulesTable.id))
    .innerJoin(coursesTable, eq(modulesTable.courseId, coursesTable.id))
    .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
    .innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
    .where(sql`${contentTable.id}::text = ${normalizedContentId}`)
    .then(result => result[0]?.email);

    if (educatorEmail) {
      try {
        await sendEmail(
          educatorEmail,
          'New Doubt Posted',
          `A new doubt "${title}" has been posted in your course`
        );
      } catch (emailError) {
        console.error('Failed to send doubt notification email:', emailError);
      }
    }

    return res.status(201).json({
      success: true,
      data: newDoubt[0]
    });
  } catch (error) {
    console.error('Error creating doubt:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating doubt'
    });
  }
};

export const getDoubtsByContent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contentId } = req.params;

    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }

    const doubts = await db.select({
      id: doubtsTable.id,
      fileId: doubtsTable.fileId,
      classId: doubtsTable.classId,
      date: doubtsTable.date,
      educatorAssigned: doubtsTable.educatorAssigned,
      resolved: doubtsTable.resolved,
      userId: doubtsTable.userId,
      contentId: doubtsTable.contentId,
      title: doubtsTable.title,
      description: doubtsTable.description,
      status: doubtsTable.status
    })
      .from(doubtsTable)
      .where(sql`${doubtsTable.contentId}::text = ${contentId}`)
      .orderBy(desc(doubtsTable.date));

    return res.status(200).json({
      success: true,
      doubts
    });
  } catch (error) {
    console.error('Error fetching doubts by content:', error);
    return res.status(200).json({
      success: false,
      message: 'Error fetching doubts',
      doubts: []
    });
  }
};

export const getDoubts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const filter = (req.query.filter as string | undefined)?.toLowerCase();
    let doubts;

    if (filter === 'open') {
      doubts = await db.select({
        id: doubtsTable.id,
        fileId: doubtsTable.fileId,
        classId: doubtsTable.classId,
        date: doubtsTable.date,
        educatorAssigned: doubtsTable.educatorAssigned,
        resolved: doubtsTable.resolved,
        userId: doubtsTable.userId,
        contentId: doubtsTable.contentId,
        title: doubtsTable.title,
        description: doubtsTable.description,
        status: doubtsTable.status
      })
        .from(doubtsTable)
        .where(and(
          eq(doubtsTable.userId, userId),
          eq(doubtsTable.status, 'open')
        ))
        .orderBy(desc(doubtsTable.date));
    } else if (filter === 'resolved') {
      doubts = await db.select({
        id: doubtsTable.id,
        fileId: doubtsTable.fileId,
        classId: doubtsTable.classId,
        date: doubtsTable.date,
        educatorAssigned: doubtsTable.educatorAssigned,
        resolved: doubtsTable.resolved,
        userId: doubtsTable.userId,
        contentId: doubtsTable.contentId,
        title: doubtsTable.title,
        description: doubtsTable.description,
        status: doubtsTable.status
      })
        .from(doubtsTable)
        .where(and(
          eq(doubtsTable.userId, userId),
          or(eq(doubtsTable.status, 'answered'), eq(doubtsTable.resolved, true))
        ))
        .orderBy(desc(doubtsTable.date));
    } else {
      doubts = await db.select({
        id: doubtsTable.id,
        fileId: doubtsTable.fileId,
        classId: doubtsTable.classId,
        date: doubtsTable.date,
        educatorAssigned: doubtsTable.educatorAssigned,
        resolved: doubtsTable.resolved,
        userId: doubtsTable.userId,
        contentId: doubtsTable.contentId,
        title: doubtsTable.title,
        description: doubtsTable.description,
        status: doubtsTable.status
      })
        .from(doubtsTable)
        .where(eq(doubtsTable.userId, userId))
        .orderBy(desc(doubtsTable.date));
    }

    return res.status(200).json({
      success: true,
      doubts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching doubts'
    });
  }
};

export const getDoubtDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doubtId = req.params.id;

    const [doubt] = await db.select({
      id: doubtsTable.id,
      fileId: doubtsTable.fileId,
      classId: doubtsTable.classId,
      date: doubtsTable.date,
      educatorAssigned: doubtsTable.educatorAssigned,
      resolved: doubtsTable.resolved,
      userId: doubtsTable.userId,
      contentId: doubtsTable.contentId,
      title: doubtsTable.title,
      description: doubtsTable.description,
      status: doubtsTable.status
    })
      .from(doubtsTable)
      .where(eq(doubtsTable.id, doubtId))
      .limit(1);

    if (!doubt) {
      return res.status(404).json({
        success: false,
        message: 'Doubt not found'
      });
    }

    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.doubtId, doubtId));

    return res.status(200).json({
      success: true,
      doubt: {
        ...doubt,
        messages
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching doubt details'
    });
  }
};

export const replyToDoubt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doubtId = req.params.id;
    const { content } = req.body;
    const userId = req.user.id;

    // Get educator ID from users table
    const educator = await db.select()
      .from(educatorsTable)
      .where(eq(educatorsTable.userId, userId))
      .limit(1);

    if (!educator.length) {
      return res.status(403).json({
        success: false,
        message: 'Only educators can reply to doubts'
      });
    }
     

    // First verify the doubt exists and get associated content and student info
    const doubtInfo = await db.select({
      contentId: doubtsTable.contentId,
      studentEmail: usersTable.email,
      doubtTitle: doubtsTable.title
    })
    .from(doubtsTable)
    .innerJoin(usersTable, eq(doubtsTable.userId, usersTable.id))
    .where(eq(doubtsTable.id, doubtId))
    .limit(1);

    if (!doubtInfo.length) {
      return res.status(404).json({
        success: false,
        message: 'Doubt not found'
      });
    }
    

    // Verify if the educator is teaching this course
    const isTeachingCourse = await db
      .select()
      .from(contentTable)
      .innerJoin(modulesTable, eq(contentTable.moduleId, modulesTable.id))
      .innerJoin(coursesTable, eq(modulesTable.courseId, coursesTable.id))
      .where(and(
        eq(contentTable.id, doubtInfo[0].contentId),
        eq(coursesTable.educatorId, educator[0].id)
      ))
      .limit(1);

    if (!isTeachingCourse.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reply to this doubt'
      });
    }

    // Add console.log to debug the values
    console.log('Inserting message with:', { doubtId, content });

    // Add debug logs
    console.log('Attempting to insert message with data:', {
      doubtId,
      content,
      isResponse: true
    });

    const newMessage = await db.insert(messagesTable)
      .values({
        doubtId: doubtId,
        text: content,
        isResponse: true   // Use isResponse to match the schema definition
      })
      .returning()
      .catch(err => {
        console.error('Database error:', err);
        throw err;
      });

    console.log('Inserted message result:', newMessage);

    // Update doubt status and assign educator
    await db.update(doubtsTable)
      .set({ 
        status: 'answered',
        resolved: true,
        educatorAssigned: educator[0].id
      })
      .where(eq(doubtsTable.id, doubtId));

    // Send email notification to student
    try {
      await sendEmail(
        doubtInfo[0].studentEmail,
        'Your Doubt Has Been Answered',
        `Your doubt "${doubtInfo[0].doubtTitle}" has received a response from the educator: "${content}"`
      );
    } catch (emailError) {
      console.error('Failed to send doubt reply email:', emailError);
    }

    return res.status(201).json({
      success: true,
      data: newMessage[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error replying to doubt'
    });
  }
};

// Add new function to get realtime updates status
export const getRealtimeStatus = async (_req: Request, res: Response) => {
  try {
    const status = {
      doubtsChannel: doubtChannel.state,
      messagesChannel: messageChannel.state
    };

    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error getting realtime status'
    });
  }
};











