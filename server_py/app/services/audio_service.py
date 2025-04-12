import numpy as np
import librosa
from scipy.io import wavfile
from io import BytesIO
import tempfile
import os
from fastapi import HTTPException
import subprocess
import io
import soundfile as sf

def process_audio(audio_bytes: bytes, pitch_steps: float, tempo: float) -> bytes:
    """
    Process audio with pitch shifting and time stretching.

    Args:
        audio_bytes: Raw audio bytes
        pitch_steps: Number of semitones to shift (can be fractional)
        tempo: Tempo multiplier (1.0 = original speed)

    Returns:
        Processed audio as bytes
    """
    temp_file = None
    try:
        # Validate input parameters
        if not isinstance(pitch_steps, (int, float)):
            raise ValueError(f"Invalid pitch_steps type: {type(pitch_steps)}. Expected number.")
        if not isinstance(tempo, (int, float)):
            raise ValueError(f"Invalid tempo type: {type(tempo)}. Expected number.")
        if tempo <= 0:
            raise ValueError(f"Invalid tempo value: {tempo}. Must be positive.")

        print(f"Processing audio with pitch_steps={pitch_steps}, tempo={tempo}")

        # Save to temporary file first
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_file.write(audio_bytes)
        temp_file.close()
        print(f"Saved {len(audio_bytes)} bytes to temporary file: {temp_file.name}")

        # Validate the audio file format
        try:
            info = sf.info(temp_file.name)
            print(f"Audio file info: format={info.format}, samplerate={info.samplerate}, channels={info.channels}, duration={info.duration}s")
        except Exception as e:
            raise Exception(f"Invalid audio file format: {str(e)}")

        # Load audio from temporary file
        try:
            y, sr = librosa.load(temp_file.name, sr=None)
            print(f"Loaded audio: shape={y.shape}, sample_rate={sr}")
        except Exception as e:
            raise Exception(f"Error loading audio file: {str(e)}")

        # Apply pitch shifting while preserving tempo
        try:
            y_shifted = librosa.effects.pitch_shift(
                y=y,
                sr=sr,
                n_steps=pitch_steps,
                bins_per_octave=12
            )
            print(f"Applied pitch shift: shape={y_shifted.shape}")
        except Exception as e:
            raise Exception(f"Error during pitch shifting: {str(e)}")

        # Apply time stretching if tempo is not 1.0
        if tempo != 1.0:
            try:
                y_shifted = librosa.effects.time_stretch(y_shifted, rate=tempo)
                print(f"Applied time stretch: shape={y_shifted.shape}")
            except Exception as e:
                raise Exception(f"Error during time stretching: {str(e)}")

        # Convert back to bytes
        try:
            output = io.BytesIO()
            # Convert to int16 format
            y_shifted_int = np.int16(y_shifted * 32767)
            wavfile.write(output, sr, y_shifted_int)
            result_bytes = output.getvalue()
            print(f"Converted to bytes: size={len(result_bytes)}")
            return result_bytes
        except Exception as e:
            raise Exception(f"Error converting processed audio to bytes: {str(e)}")

    except Exception as e:
        print(f"Error in process_audio: {str(e)}")
        raise Exception(f"Error processing audio: {str(e)}")
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
                print(f"Cleaned up temporary file: {temp_file.name}")
            except Exception as e:
                print(f"Warning: Could not delete temporary file {temp_file.name}: {str(e)}")
