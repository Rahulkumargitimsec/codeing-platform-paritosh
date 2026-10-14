const cloudinary = require('cloudinary').v2;
const Problem = require("../models/problem");
const User = require("../models/user");
const SolutionVideo = require("../models/solutionVideo");


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const videoConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const notConfigured = (res) => res.status(400).json({
  error: 'Video uploads are not set up',
  message: 'Video uploads need Cloudinary. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env and restart the server.',
});

const generateUploadSignature = async (req, res) => {
  try {
    if (!videoConfigured()) return notConfigured(res);
    const { problemId } = req.params;
    
    const userId = req.result._id;
    // Verify problem exists
    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found', message: 'Problem not found' });
    }

    // Generate unique public_id for the video
    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = `leetcode-solutions/${problemId}/${userId}_${timestamp}`;
    
    // Upload parameters
    const uploadParams = {
      timestamp: timestamp,
      public_id: publicId,
    };

    // Generate signature
    const signature = cloudinary.utils.api_sign_request(
      uploadParams,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      public_id: publicId,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      upload_url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
    });

  } catch (error) {
    console.error('Error generating upload signature:', error);
    res.status(500).json({ error: 'Failed to generate upload credentials', message: 'Could not create upload credentials: ' + error.message });
  }
};


const saveVideoMetadata = async (req, res) => {
  try {
    if (!videoConfigured()) return notConfigured(res);
    const {
      problemId,
      cloudinaryPublicId,
      secureUrl,
      duration,
    } = req.body;

    const userId = req.result._id;

    // Verify the upload with Cloudinary
    const cloudinaryResource = await cloudinary.api.resource(
      cloudinaryPublicId,
      { resource_type: 'video' }
    );

    if (!cloudinaryResource) {
      return res.status(400).json({ error: 'Video not found on Cloudinary' });
    }

    // Check if video already exists for this problem and user
    const existingVideo = await SolutionVideo.findOne({
      problemId,
      userId,
      cloudinaryPublicId
    });

    if (existingVideo) {
      return res.status(409).json({ error: 'Video already exists' });
    }

    // const thumbnailUrl = cloudinary.url(cloudinaryResource.public_id, {
    // resource_type: 'image',  
    // transformation: [
    // { width: 400, height: 225, crop: 'fill' },
    // { quality: 'auto' },
    // { start_offset: 'auto' }  
    // ],
    // format: 'jpg'
    // });

    const thumbnailUrl = cloudinary.url(cloudinaryResource.public_id, {
      resource_type: 'video',
      format: 'jpg',
      secure: true,
      transformation: [{ width: 1280, height: 720, crop: 'fill', start_offset: 'auto' }],
    });

    // One editorial video per problem: replace any previous one
    const previous = await SolutionVideo.find({ problemId });
    for (const old of previous) {
      await cloudinary.uploader.destroy(old.cloudinaryPublicId, { resource_type: 'video', invalidate: true }).catch(() => {});
      await old.deleteOne();
    }

// https://cloudinary.com/documentation/video_effects_and_enhancements#video_thumbnails
    // Create video solution record
    const videoSolution = await SolutionVideo.create({
      problemId,
      userId,
      cloudinaryPublicId,
      secureUrl,
      duration: cloudinaryResource.duration || duration,
      thumbnailUrl
    });


    res.status(201).json({
      message: 'Video solution saved successfully',
      videoSolution: {
        id: videoSolution._id,
        thumbnailUrl: videoSolution.thumbnailUrl,
        duration: videoSolution.duration,
        uploadedAt: videoSolution.createdAt
      }
    });

  } catch (error) {
    console.error('Error saving video metadata:', error);
    res.status(500).json({ error: 'Failed to save video metadata', message: 'Could not save the video: ' + (error.message || error.error?.message || 'unknown error') });
  }
};


const deleteVideo = async (req, res) => {
  try {
    const { problemId } = req.params;
    const userId = req.result._id;

    const video = await SolutionVideo.findOneAndDelete({problemId:problemId});
    
   

    if (!video) {
      return res.status(404).json({ error: 'Video not found', message: 'This problem has no video' });
    }

    if (videoConfigured()) {
      await cloudinary.uploader.destroy(video.cloudinaryPublicId, { resource_type: 'video', invalidate: true }).catch(() => {});
    }

    res.json({ message: 'Video deleted' });

  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video', message: 'Could not delete the video: ' + error.message });
  }
};

module.exports = {generateUploadSignature,saveVideoMetadata,deleteVideo};