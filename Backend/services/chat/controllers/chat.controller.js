import prisma from "../../../shared/config/db.js"

export const createConversation = async (req,res) => {
    try {
        const userId = req.headers["x-user-id"]

        console.log("userId",userId)

        const conversation = await prisma.conversation.create({
            data:{
                userId
            },
        });

        return res.status(201).json(conversation);
    
    } catch (error) {
        console.log(error)
        
        return res.status(500).json({
            message: "Create conversation failed",
            error: error.message,
        })
    }
}

export const getConversation = async (req,res) => {
    try {
        const userId = req.headers["x-user-id"]

        console.log("userId",userId)

        const conversation = await prisma.conversation.findMany({
            where:{
                userId
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        return res.status(201).json(conversation);
    
    } catch (error) {
        console.log(error)
        
        return res.status(500).json({
            message: "failed to fetch conversations",
            error: error.message,
        })
    }
}

export const updateConversation = async (req, res) => {
  try {
    const { id, title } = req.body;

    const conversation = await prisma.conversation.update({
      where: {
        id,
      },
      data: {
        title,
      },
    });

    return res.status(200).json(conversation);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Update conversation failed",
      error: error.message,
    });
  }
};

export const saveMessage = async (req, res) => {
  try {
    const { conversationId, role, content,images = [],artifacts = [] } = req.body;

    const data = {
      conversationId,
      role,
      content,
      images,
    };

    if (artifacts.length > 0) {
      data.artifacts = {
        create: artifacts.map((artifact) => ({
          type: artifact.type,
            title: artifact.title,

          files: {
            create: artifact.files.map((file) => ({
              name: file.name,
              content: file.content,
            })),
          },
        })),
      };
    }

    const message = await prisma.message.create({
      data
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Save message failed",
      error: error.message,
    });
  }
};

export const getMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const message = await prisma.message.findMany({
      where: {
        conversationId
      }
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "get message failed",
      error: error.message,
    });
  }
};