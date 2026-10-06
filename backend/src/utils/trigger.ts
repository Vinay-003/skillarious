import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { doubtsTable, messagesTable, contentTable, usersTable, modulesTable, coursesTable, educatorsTable } from '../db/schema.ts';
import { sendEmail } from '../utils/sendEmail.ts';
import { eq, and } from 'drizzle-orm';
import { doubtChannel, messageChannel } from '../utils/storage.ts';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  }
}

export const initializeTriggers = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS doubt_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doubt_id uuid REFERENCES doubts(id),
        action VARCHAR(50),
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(`
      CREATE OR REPLACE FUNCTION log_doubt_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO doubt_logs (doubt_id, action, new_status, changed_at)
          VALUES (NEW.id, 'INSERT', NEW.status, CURRENT_TIMESTAMP);
        ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO doubt_logs (doubt_id, action, old_status, new_status, changed_at)
          VALUES (NEW.id, 'UPDATE', OLD.status, NEW.status, CURRENT_TIMESTAMP);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await db.execute(`
      DROP TRIGGER IF EXISTS doubt_changes_trigger ON doubts;
      CREATE TRIGGER doubt_changes_trigger
      AFTER INSERT OR UPDATE ON doubts
      FOR EACH ROW
      EXECUTE FUNCTION log_doubt_changes();
    `);

    console.log('SQL triggers initialized successfully');
  } catch (error) {
    console.error('Error initializing SQL triggers:', error);
    throw error;
  }
};

export const createDoubt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contentId, title, description } = req.body;
    const userId = req.user.id;

    // Verify content exists
    const content = await db.select()
      .from(contentTable)
      .where(eq(contentTable.id, contentId))
      .limit(1);

    if (!content.length) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    const newDoubt = await db.insert(doubtsTable).values({
      date: new Date(),
      message: description,
      contentId,
      userId,
      title,
      description,
      status: 'open'
    }).returning();

    const educatorEmail = await db.select({
      email: usersTable.email
    })
    .from(contentTable)
    .innerJoin(modulesTable, eq(contentTable.moduleId, modulesTable.id))
    .innerJoin(coursesTable, eq(modulesTable.courseId, coursesTable.id))
    .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
    .innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
    .where(eq(contentTable.id, contentId))
    .then(result => result[0]?.email);

    if (!educatorEmail) {
      throw new Error('Educator email not found');
    }
    await sendEmail(
      educatorEmail,
      'New Doubt Posted',
      `A new doubt "${title}" has been posted in your course`
    );

    return res.status(201).json({
      success: true,
      data: newDoubt[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating doubt'
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
     
    const doubtInfo = await db.select({
      doubt: doubtsTable.message,
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


    // Update doubt status and assign educator
    await db.update(doubtsTable)
      .set({ 
        status: 'answered',
        educatorAssigned: educator[0].id
      })
      .where(eq(doubtsTable.id, doubtId));

    // Send email notification to student
    await sendEmail(
      doubtInfo[0].studentEmail,
      'Your Doubt Has Been Answered',
      `Your doubt "${doubtInfo[0].doubtTitle}" has received a response from the educator: "${content}"`
    );

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

// Initialize triggers when the module is loaded
initializeTriggers().catch(err => {
  console.error('Failed to initialize triggers on startup:', err);
});
